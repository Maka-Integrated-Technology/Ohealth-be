import { randomInt, timingSafeEqual } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { setTimeout as sleep } from 'node:timers/promises';

import {
  BadRequestException,
  ConflictException,
  HttpException,
  Injectable,
} from '@nestjs/common';
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
import {
  IIssuedSession,
  RefreshSessionService,
} from '../sessions/refresh-session.service';

import { AuthChallengeDeliveryService } from './auth-challenge-delivery.service';
import { AuthChallengePurpose } from './auth-challenge.entity';
import { AuthChallengeService } from './auth-challenge.service';

const QUEUED =
  'If this account is eligible, a verification message has been queued.';
const LOGIN_QUEUED = 'Login verification queued';

export interface ILoginChallengeResponse {
  message: string;
  challenge_id: string;
  resend_after_seconds: number;
  expires_in_seconds: number;
}

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
    private readonly sessions: RefreshSessionService,
  ) {}

  async requestLogin(
    passwordProvenUser: User,
  ): Promise<ILoginChallengeResponse> {
    try {
      await this.delivery.assertLiveFlowReady();
      return await this.dataSource.transaction(async (manager) => {
        const user = await manager.findOne(User, {
          where: { id: passwordProvenUser.id },
          lock: { mode: 'pessimistic_write' },
        });
        this.policy.assertCanAuthenticate(user);
        if (
          !user ||
          !this.sameSecret(user.password, passwordProvenUser.password)
        ) {
          throw new BadRequestException(sysMsg.INVALID_CREDENTIALS);
        }
        const issued = await this.delivery.queueInTransaction(
          manager,
          user,
          AuthChallengePurpose.LOGIN_VERIFICATION,
        );
        await this.audit.recordInTransaction(manager, {
          event_type: AuthSecurityEventType.LOGIN_CHALLENGE_REQUEST,
          outcome: AuthSecurityEventOutcome.SUCCEEDED,
          subject_user_id: user.id,
        });
        return this.loginChallengeResponse(issued);
      });
    } catch (error) {
      await this.audit.recordAttempt({
        event_type: AuthSecurityEventType.LOGIN_CHALLENGE_REQUEST,
        outcome:
          error instanceof HttpException
            ? AuthSecurityEventOutcome.DENIED
            : AuthSecurityEventOutcome.FAILED,
        subject_user_id: passwordProvenUser.id,
      });
      throw error;
    }
  }

  async rejectLoginAttempt(): Promise<void> {
    await this.audit.recordAttempt({
      event_type: AuthSecurityEventType.LOGIN_CHALLENGE_REQUEST,
      outcome: AuthSecurityEventOutcome.DENIED,
    });
  }

  async verifyLogin(
    challengeId: string,
    code: string,
  ): Promise<{ user: User; session: IIssuedSession }> {
    try {
      return await this.challenges.consumeWithMutation(
        challengeId,
        AuthChallengePurpose.LOGIN_VERIFICATION,
        code,
        async (manager, userId) => {
          const user = await manager.findOne(User, {
            where: { id: userId },
            lock: { mode: 'pessimistic_write' },
          });
          this.policy.assertCanAuthenticate(user);
          if (!user) throw new Error('Login challenge subject missing.');
          const session = await this.sessions.issueInTransaction(
            manager,
            user.id,
          );
          await this.audit.recordInTransaction(manager, {
            event_type: AuthSecurityEventType.LOGIN_CHALLENGE_VERIFICATION,
            outcome: AuthSecurityEventOutcome.SUCCEEDED,
            actor_user_id: user.id,
            subject_user_id: user.id,
            session_id: session.session_id,
          });
          return { user, session };
        },
      );
    } catch (error) {
      if (error instanceof HttpException) {
        const rows: Array<{
          purpose: AuthChallengePurpose;
          subject_user_id: string;
          expires_at: Date;
        }> = await this.dataSource.query(
          'SELECT purpose, subject_user_id, expires_at FROM auth_challenges ' +
            'WHERE id = $1',
          [challengeId],
        );
        const challenge = rows[0];
        const isLoginChallenge =
          challenge?.purpose === AuthChallengePurpose.LOGIN_VERIFICATION;
        await this.audit.recordAttempt({
          event_type:
            isLoginChallenge &&
            new Date(challenge.expires_at).getTime() <= Date.now()
              ? AuthSecurityEventType.LOGIN_CHALLENGE_EXPIRY
              : AuthSecurityEventType.LOGIN_CHALLENGE_VERIFICATION,
          outcome: AuthSecurityEventOutcome.DENIED,
          subject_user_id: isLoginChallenge
            ? challenge.subject_user_id
            : undefined,
        });
      }
      throw error;
    }
  }

  async resendLogin(challengeId: string): Promise<ILoginChallengeResponse> {
    const started = performance.now();
    const responseFloorMs = 350 + randomInt(0, 250);
    let response = this.loginChallengeResponse({
      challengeId,
      resendAfterSeconds: 60,
      expiresInSeconds: 600,
    });
    try {
      await this.delivery.assertLiveFlowReady();
      await this.dataSource.transaction(async (manager) => {
        const references: Array<{ subject_user_id: string }> =
          await manager.query(
            'SELECT subject_user_id FROM auth_challenges ' +
              'WHERE id = $1 AND purpose = $2',
            [challengeId, AuthChallengePurpose.LOGIN_VERIFICATION],
          );
        if (!references.length) {
          await this.recordDeniedLoginResend(manager);
          return;
        }
        const user = await manager.findOne(User, {
          where: { id: references[0].subject_user_id },
          lock: { mode: 'pessimistic_write' },
        });
        try {
          this.policy.assertCanAuthenticate(user);
        } catch {
          await this.recordDeniedLoginResend(
            manager,
            references[0].subject_user_id,
          );
          return;
        }
        if (!user) {
          await this.recordDeniedLoginResend(manager);
          return;
        }
        const latest: Array<{
          id: string;
          issued_at: Date;
          expires_at: Date;
        }> = await manager.query(
          'SELECT id, issued_at, expires_at FROM auth_challenges ' +
            'WHERE subject_user_id = $1 AND purpose = $2 ' +
            'AND consumed_at IS NULL AND expires_at > now() ' +
            'ORDER BY issued_at DESC LIMIT 1',
          [user.id, AuthChallengePurpose.LOGIN_VERIFICATION],
        );
        const current = latest[0];
        if (!current || current.id !== challengeId) {
          await this.recordDeniedLoginResend(manager, user.id);
          return;
        }
        const ageMs = Date.now() - new Date(current.issued_at).getTime();
        response = this.loginChallengeResponse({
          challengeId: current.id,
          resendAfterSeconds: Math.max(0, Math.ceil((60_000 - ageMs) / 1000)),
          expiresInSeconds: Math.max(
            1,
            Math.ceil(
              (new Date(current.expires_at).getTime() - Date.now()) / 1000,
            ),
          ),
        });
        if (ageMs < 60_000) {
          await this.recordDeniedLoginResend(manager, user.id);
          return;
        }
        const issued = await this.delivery.queueInTransaction(
          manager,
          user,
          AuthChallengePurpose.LOGIN_VERIFICATION,
        );
        await this.audit.recordInTransaction(manager, {
          event_type: AuthSecurityEventType.LOGIN_CHALLENGE_RESEND,
          outcome: AuthSecurityEventOutcome.SUCCEEDED,
          subject_user_id: user.id,
        });
        response = this.loginChallengeResponse(issued);
      });
      return response;
    } catch (error) {
      await this.audit.recordAttempt({
        event_type: AuthSecurityEventType.LOGIN_CHALLENGE_RESEND,
        outcome:
          error instanceof HttpException
            ? AuthSecurityEventOutcome.DENIED
            : AuthSecurityEventOutcome.FAILED,
      });
      throw error;
    } finally {
      const remaining = responseFloorMs - (performance.now() - started);
      if (remaining > 0) await sleep(remaining);
    }
  }

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
        await manager.query(
          'UPDATE auth_challenges SET consumed_at = now() ' +
            'WHERE subject_user_id = $1 AND purpose = $2 AND consumed_at IS NULL',
          [user.id, AuthChallengePurpose.LOGIN_VERIFICATION],
        );
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

  private loginChallengeResponse(issued: {
    challengeId: string;
    resendAfterSeconds: number;
    expiresInSeconds: number;
  }): ILoginChallengeResponse {
    return {
      message: LOGIN_QUEUED,
      challenge_id: issued.challengeId,
      resend_after_seconds: issued.resendAfterSeconds,
      expires_in_seconds: issued.expiresInSeconds,
    };
  }

  private async recordDeniedLoginResend(
    manager: Parameters<AuthSecurityAuditService['recordInTransaction']>[0],
    subjectUserId?: string,
  ): Promise<void> {
    await this.audit.recordInTransaction(manager, {
      event_type: AuthSecurityEventType.LOGIN_CHALLENGE_RESEND,
      outcome: AuthSecurityEventOutcome.DENIED,
      subject_user_id: subjectUserId,
    });
  }

  private sameSecret(left: string, right: string): boolean {
    const leftBytes = Buffer.from(left);
    const rightBytes = Buffer.from(right);
    return (
      leftBytes.length === rightBytes.length &&
      timingSafeEqual(leftBytes, rightBytes)
    );
  }
}
