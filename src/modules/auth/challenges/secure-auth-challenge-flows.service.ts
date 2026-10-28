import { randomInt } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { setTimeout as sleep } from 'node:timers/promises';

import { ConflictException, Injectable } from '@nestjs/common';
import { DataSource, IsNull, Raw } from 'typeorm';

import * as sysMsg from '../../../constants/system.messages';
import { UserAccountStatusHistory } from '../../user/entities/user-account-status-history.entity';
import { User } from '../../user/entities/user.entity';
import { AccountStatus } from '../../user/enums/account-status.enum';
import { AccountAccessPolicyService } from '../account-access-policy.service';
import { AuthDto } from '../dto/auth.dto';
import { AuthSession } from '../entities/auth.entity';
import { AuthSecurityAuditService } from '../security-audit/auth-security-audit.service';
import {
  AuthSecurityEventOutcome,
  AuthSecurityEventType,
} from '../security-audit/auth-security-event.enum';

import { AuthChallengeDeliveryService } from './auth-challenge-delivery.service';
import { AuthChallengePurpose } from './auth-challenge.entity';
import { AuthChallengeService } from './auth-challenge.service';

const QUEUED =
  'If this account is eligible, a verification message has been queued.';

/**
 * Shared live contact-verification and recovery boundary for issue #75.
 * All identity mutations and encrypted challenge issuance use the same
 * transaction. Existing public account-registration policy stays in AuthService
 * until issue #78 replaces its legacy role-based registration contract.
 */
@Injectable()
export class SecureAuthChallengeFlowsService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly delivery: AuthChallengeDeliveryService,
    private readonly challenges: AuthChallengeService,
    private readonly policy: AccountAccessPolicyService,
    private readonly audit: AuthSecurityAuditService,
  ) {}

  async signup(
    dto: AuthDto,
    hashedPassword: string,
  ): Promise<{ user: User; challengeId: string }> {
    await this.delivery.assertLiveFlowReady();
    const email = dto.email.trim().toLowerCase();
    try {
      return await this.dataSource.transaction(async (manager) => {
        // Legacy casing can exist before the normalized-uniqueness migration
        // from #78. New signups always persist normalized email.
        const matches: Array<{ id: string }> = await manager.query(
          'SELECT id FROM users WHERE lower(btrim(email)) = $1 LIMIT 1',
          [email],
        );
        if (matches.length) {
          throw new ConflictException(sysMsg.ACCOUNT_ALREADY_EXISTS);
        }
        const user = await manager.save(
          User,
          manager.create(User, {
            email,
            password: hashedPassword,
            first_name: dto.first_name.trim(),
            last_name: dto.last_name.trim(),
            middle_name: dto.middle_name?.trim() || null,
            gender: dto.gender ?? null,
            dob: dto.dob ?? null,
            phone: dto.phone ?? null,
            role: dto.role,
            is_active: false,
            is_verified: false,
            account_status: AccountStatus.PENDING_VERIFICATION,
            email_verified_at: null,
            verification_code: null,
            verification_code_expires_at: null,
            reset_token: null,
            reset_token_expiry: null,
          }),
        );
        const issued = await this.delivery.queueInTransaction(
          manager,
          user,
          AuthChallengePurpose.CONTACT_VERIFICATION,
        );
        await this.audit.recordInTransaction(manager, {
          event_type: AuthSecurityEventType.REGISTRATION,
          outcome: AuthSecurityEventOutcome.SUCCEEDED,
          subject_user_id: user.id,
        });
        return { user, challengeId: issued.challengeId };
      });
    } catch (error: unknown) {
      if ((error as { code?: string })?.code === '23505') {
        throw new ConflictException(sysMsg.ACCOUNT_ALREADY_EXISTS);
      }
      throw error;
    }
  }

  async resend(email: string): Promise<{ message: string }> {
    await this.queueForEligibleAccount(
      email,
      AuthChallengePurpose.CONTACT_VERIFICATION,
    );
    return { message: QUEUED };
  }

  async requestRecovery(email: string): Promise<{ message: string }> {
    await this.queueForEligibleAccount(
      email,
      AuthChallengePurpose.PASSWORD_RECOVERY,
    );
    return { message: QUEUED };
  }

  async verifyContact(challengeId: string, code: string): Promise<User> {
    return this.challenges.consumeWithMutation(
      challengeId,
      AuthChallengePurpose.CONTACT_VERIFICATION,
      code,
      async (manager, userId) => {
        const user = await manager.findOne(User, {
          where: { id: userId },
          lock: { mode: 'pessimistic_write' },
        });
        if (!user) throw new Error('Challenge subject missing.');
        this.policy.assertCanVerifyContact(user);
        const now = new Date();
        user.account_status = AccountStatus.ACTIVE;
        user.email_verified_at = now;
        user.is_active = true;
        user.is_verified = true;
        user.verification_code = null;
        user.verification_code_expires_at = null;
        const saved = await manager.save(User, user);
        await manager.insert(UserAccountStatusHistory, {
          user_id: user.id,
          previous_status: AccountStatus.PENDING_VERIFICATION,
          new_status: AccountStatus.ACTIVE,
          changed_by_user_id: null,
          reason: 'verified_contact_challenge',
        });
        await this.audit.recordInTransaction(manager, {
          event_type: AuthSecurityEventType.CONTACT_VERIFICATION,
          outcome: AuthSecurityEventOutcome.SUCCEEDED,
          subject_user_id: user.id,
        });
        return saved;
      },
    );
  }

  async completeRecovery(
    challengeId: string,
    code: string,
    newPasswordHash: string,
  ): Promise<void> {
    await this.challenges.consumeWithMutation(
      challengeId,
      AuthChallengePurpose.PASSWORD_RECOVERY,
      code,
      async (manager, userId) => {
        const user = await manager.findOne(User, {
          where: { id: userId },
          lock: { mode: 'pessimistic_write' },
        });
        if (!user) throw new Error('Recovery challenge subject missing.');
        // Account may have been suspended since recovery was issued.
        this.policy.assertCanAuthenticate(user);
        await manager.update(User, user.id, {
          password: newPasswordHash,
          reset_token: null,
          reset_token_expiry: null,
        });
        await manager.update(
          AuthSession,
          { user_id: user.id, revoked_at: IsNull() },
          { revoked_at: new Date() },
        );
        await this.audit.recordInTransaction(manager, {
          event_type: AuthSecurityEventType.PASSWORD_RECOVERY,
          outcome: AuthSecurityEventOutcome.SUCCEEDED,
          subject_user_id: user.id,
        });
      },
    );
  }

  private async queueForEligibleAccount(
    rawEmail: string,
    purpose: AuthChallengePurpose,
  ): Promise<void> {
    // Public responses have a randomized minimum duration, even on errors.
    // The wait happens outside transactions, so it cannot consume DB pool
    // connections or retain a per-account lock. Load testing must validate
    // that production p99 execution stays below this floor.
    const started = performance.now();
    const responseFloorMs = 350 + randomInt(0, 250);
    try {
      const email = rawEmail.trim().toLowerCase();
      // Full feature-flag, encryption and worker-readiness checks must run
      // BEFORE account eligibility is read; otherwise outages reveal accounts.
      await this.delivery.assertLiveFlowReady();
      await this.dataSource.transaction(async (manager) => {
        const user = await manager.findOne(User, {
          where: {
            email: Raw((column) => `lower(btrim(${column})) = :email`, {
              email,
            }),
          },
          lock: { mode: 'pessimistic_write' },
        });
        if (!user) return;
        if (purpose === AuthChallengePurpose.CONTACT_VERIFICATION) {
          if (
            user.account_status !== AccountStatus.PENDING_VERIFICATION ||
            user.email_verified_at
          )
            return;
        } else if (
          user.account_status !== AccountStatus.ACTIVE ||
          !user.email_verified_at
        ) {
          return;
        }
        // Never disclose whether a matching user has an unexpired challenge.
        // Keep rate limiting and cooldown in the underlying challenge service.
        const issuedRecently: Array<{ issued_at: Date }> = await manager.query(
          'SELECT issued_at FROM auth_challenges ' +
            'WHERE subject_user_id = $1 AND purpose = $2 ' +
            'ORDER BY issued_at DESC LIMIT 1',
          [user.id, purpose],
        );
        if (
          issuedRecently.length &&
          Date.now() - new Date(issuedRecently[0].issued_at).getTime() < 60_000
        )
          return;
        await this.delivery.queueInTransaction(manager, user, purpose);
      });
    } finally {
      const remaining = responseFloorMs - (performance.now() - started);
      if (remaining > 0) await sleep(remaining);
    }
  }
}
