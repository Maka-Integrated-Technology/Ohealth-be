import {
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { isEmail } from 'class-validator';
import { DataSource, EntityManager, IsNull } from 'typeorm';

import { UserPersona } from '../../identity/entities/user-persona.entity';
import { UserPersonaType } from '../../identity/enums/user-persona-type.enum';
import { User } from '../../user/entities/user.entity';
import { AccountAccessPolicyService } from '../account-access-policy.service';
import { AuthChallengeDeliveryService } from '../challenges/auth-challenge-delivery.service';
import {
  AuthChallengePurpose,
  AuthChallengeTerminalReason,
} from '../challenges/auth-challenge.entity';
import {
  AuthChallengeErrorCode,
  AuthChallengeException,
} from '../challenges/auth-challenge.error';
import { AuthChallengeService } from '../challenges/auth-challenge.service';
import { AuthRateLimitService } from '../challenges/auth-rate-limit.service';
import { AuthSession } from '../entities/auth.entity';
import { PasswordCredentialsService } from '../password-policy/password-credentials.service';
import { AuthSecurityAuditService } from '../security-audit/auth-security-audit.service';
import {
  AuthSecurityEventOutcome,
  AuthSecurityEventType,
} from '../security-audit/auth-security-event.enum';
import { TwoFactorAuthService } from '../two-factor-auth.service';

import {
  BeginEmailChangeDto,
  EmailChangeChallengeDto,
  EmailChangeCommittedDto,
} from './email-change.dto';
import { EmailDestinationService, IEncryptedEmail } from './email-destination';

interface IEmailChangeRow extends IEncryptedEmail {
  lineage_id: string;
  subject_user_id: string;
  destination_hash: string;
  deliverable: boolean;
}

const invalid = () =>
  new AuthChallengeException(
    AuthChallengeErrorCode.INVALID,
    HttpStatus.BAD_REQUEST,
  );

@Injectable()
export class EmailChangeService {
  constructor(
    private readonly db: DataSource,
    private readonly policy: AccountAccessPolicyService,
    private readonly passwords: PasswordCredentialsService,
    private readonly mfa: TwoFactorAuthService,
    private readonly challenges: AuthChallengeService,
    private readonly delivery: AuthChallengeDeliveryService,
    private readonly destinations: EmailDestinationService,
    private readonly rates: AuthRateLimitService,
    private readonly audit: AuthSecurityAuditService,
  ) {}

  async begin(
    userId: string,
    sessionId: string,
    body: BeginEmailChangeDto,
  ): Promise<EmailChangeChallengeDto> {
    try {
      const email = this.normalize(body.candidate_email);
      await this.limit('email-change:account', userId, 4, 3600);
      await this.ready();
      await this.limit(
        'email-change:destination',
        this.destinations.hash(email),
        4,
        3600,
      );
      return await this.db.transaction(async (manager) => {
        const user = await this.lockEligible(manager, userId, sessionId);
        await this.reauthenticate(manager, user, sessionId, body);
        if (user.email === email) throw invalid();
        await this.lockDestination(manager, email);
        const deliverable = !(await this.owned(manager, email, userId));
        // An owned address receives a real, purpose-bound, undeliverable
        // challenge. The public handle, cooldown and resend behavior match.
        const issued = await this.challenges.issueInTransaction(
          manager,
          userId,
          AuthChallengePurpose.EMAIL_CHANGE,
        );
        const encrypted = this.destinations.encrypt(issued.lineageId, email);
        await manager.query(
          'INSERT INTO auth_email_changes (lineage_id, subject_user_id, destination_hash, destination_iv, destination_ciphertext, destination_tag, deliverable, expires_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
          [
            issued.lineageId,
            userId,
            this.destinations.hash(email),
            encrypted.destination_iv,
            encrypted.destination_ciphertext,
            encrypted.destination_tag,
            deliverable,
            issued.flowExpiresAt,
          ],
        );
        if (deliverable)
          await this.delivery.stageEmailChangeInTransaction(
            manager,
            issued.challengeId,
            issued.code,
          );
        return this.continuation(issued.challengeId, issued.expiresAt);
      });
    } catch (error) {
      const publicError = this.isUniqueViolation(error) ? invalid() : error;
      await this.auditFailure(userId, publicError);
      throw publicError;
    }
  }

  async resend(
    userId: string,
    sessionId: string,
    challengeId: string,
  ): Promise<EmailChangeChallengeDto> {
    try {
      await this.limit('email-change:resend', userId, 5, 3600);
      await this.ready();
      return await this.db.transaction(async (manager) => {
        await this.lockEligible(manager, userId, sessionId);
        const row = await this.getRow(manager, challengeId, userId);
        if (!row) throw invalid();
        const replacement = row.deliverable
          ? await this.delivery.replaceInTransaction(
              manager,
              challengeId,
              AuthChallengePurpose.EMAIL_CHANGE,
            )
          : await this.challenges.replaceInTransaction(
              manager,
              challengeId,
              AuthChallengePurpose.EMAIL_CHANGE,
            );
        return {
          challenge_id: replacement.challengeId,
          expires_in_seconds:
            'expiresInSeconds' in replacement
              ? replacement.expiresInSeconds
              : Math.max(
                  1,
                  Math.ceil(
                    (replacement.expiresAt.getTime() - Date.now()) / 1000,
                  ),
                ),
          resend_after_seconds: replacement.resendAfterSeconds,
        };
      });
    } catch (error) {
      await this.auditFailure(userId, error);
      throw error;
    }
  }

  async confirm(
    userId: string,
    sessionId: string,
    challengeId: string,
    code: string,
  ): Promise<EmailChangeCommittedDto> {
    try {
      await this.limit('email-change:confirm', userId, 12, 3600);
      return await this.challenges.consumeWithMutation(
        challengeId,
        AuthChallengePurpose.EMAIL_CHANGE,
        code,
        async (manager, subjectId) => {
          if (subjectId !== userId) throw invalid();
          const user = await this.lockEligible(manager, userId, sessionId);
          const row = await this.getRow(manager, challengeId, userId);
          if (!row || !row.deliverable) throw invalid();
          const email = this.destinations.decrypt(row.lineage_id, row);
          if (
            this.destinations.hash(email) !== row.destination_hash ||
            this.normalize(email) !== email
          )
            throw invalid();
          await this.lockDestination(manager, email);
          if (
            (await this.owned(manager, email, userId)) ||
            user.email === email
          )
            throw invalid();
          user.email = email;
          user.email_verified_at = new Date();
          await manager.save(user);
          await manager.query(
            'UPDATE auth_challenges SET consumed_at = now(), terminal_reason = $3 WHERE subject_user_id = $1 AND purpose = ANY($2) AND terminal_reason IS NULL',
            [
              userId,
              [
                AuthChallengePurpose.EMAIL_CHANGE,
                AuthChallengePurpose.LOGIN_VERIFICATION,
                AuthChallengePurpose.MFA_LOGIN,
                AuthChallengePurpose.PASSWORD_RECOVERY,
              ],
              AuthChallengeTerminalReason.ADMINISTRATIVELY_REVOKED,
            ],
          );
          await manager.query(
            'DELETE FROM auth_email_changes WHERE subject_user_id = $1',
            [userId],
          );
          await manager.update(
            AuthSession,
            { user_id: userId, revoked_at: IsNull() },
            { revoked_at: new Date() },
          );
          await this.audit.recordInTransaction(manager, {
            event_type: AuthSecurityEventType.EMAIL_CHANGE,
            outcome: AuthSecurityEventOutcome.SUCCEEDED,
            actor_user_id: userId,
            subject_user_id: userId,
            session_id: sessionId,
          });
          return { sessions_revoked: true };
        },
      );
    } catch (error) {
      const publicError = this.isUniqueViolation(error) ? invalid() : error;
      await this.auditFailure(userId, publicError);
      throw publicError;
    }
  }

  private normalize(raw: string): string {
    if (typeof raw !== 'string') throw invalid();
    const email = raw.trim().normalize('NFC').toLowerCase();
    if (email.length > 254 || !isEmail(email)) throw invalid();
    return email;
  }

  private async reauthenticate(
    manager: EntityManager,
    user: User,
    sessionId: string,
    body: BeginEmailChangeDto,
  ): Promise<void> {
    if (user.password_authentication_enabled) {
      if (
        !body.current_password ||
        !(await this.passwords.verify(body.current_password, user.password))
      )
        throw new UnauthorizedException({
          message: 'Recent authentication required.',
          error_code: 'EMAIL_CHANGE_REAUTHENTICATION_REQUIRED',
        });
    } else {
      // Matches the existing OAuth unlink step-up policy. A refresh does not
      // advance the original session creation time.
      const session = await manager.findOne(AuthSession, {
        where: { user_id: user.id, session_id: sessionId },
      });
      if (
        !session ||
        session.credential_version !== 2 ||
        session.created_at < new Date(Date.now() - 10 * 60_000)
      )
        throw new UnauthorizedException({
          message: 'Recent authentication required.',
          error_code: 'EMAIL_CHANGE_REAUTHENTICATION_REQUIRED',
        });
    }
    if (await this.mfa.isEnabled(manager, user.id)) {
      if (
        !body.mfa_code ||
        !(await this.mfa.verifyForLogin(manager, user.id, body.mfa_code))
      )
        throw new UnauthorizedException({
          message: 'Current MFA proof required.',
          error_code: 'EMAIL_CHANGE_MFA_REQUIRED',
        });
    }
  }

  private async lockEligible(
    manager: EntityManager,
    userId: string,
    sessionId: string,
  ): Promise<User> {
    const user = await manager.findOne(User, {
      where: { id: userId },
      lock: { mode: 'pessimistic_write' },
    });
    this.policy.assertCanAuthenticate(user);
    if (!user) throw new ForbiddenException('Account unavailable.');
    const session = await manager.findOne(AuthSession, {
      where: { user_id: userId, session_id: sessionId, revoked_at: IsNull() },
      lock: { mode: 'pessimistic_read' },
    });
    if (!session || session.expires_at <= new Date())
      throw new ForbiddenException('Session unavailable.');
    const persona = await manager.findOne(UserPersona, {
      where: [
        {
          user_id: userId,
          persona_type: UserPersonaType.PATIENT,
          is_active: true,
        },
        {
          user_id: userId,
          persona_type: UserPersonaType.HEALTHCARE_PROFESSIONAL,
          is_active: true,
        },
      ],
    });
    if (!persona)
      throw new ForbiddenException('Personal profile access required.');
    return user;
  }

  private async getRow(
    manager: EntityManager,
    challengeId: string,
    userId: string,
  ): Promise<IEmailChangeRow | null> {
    const rows: IEmailChangeRow[] = await manager.query(
      'SELECT x.* FROM auth_email_changes x JOIN auth_challenges c ON c.lineage_id = x.lineage_id WHERE c.id = $1 AND c.purpose = $2 AND x.subject_user_id = $3 AND x.expires_at > now()',
      [challengeId, AuthChallengePurpose.EMAIL_CHANGE, userId],
    );
    return rows[0] ?? null;
  }

  private async lockDestination(
    manager: EntityManager,
    email: string,
  ): Promise<void> {
    await manager.query(
      'SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',
      [`email-change:${this.destinations.hash(email)}`],
    );
  }

  private async owned(
    manager: EntityManager,
    email: string,
    userId: string,
  ): Promise<boolean> {
    const rows: Array<{ id: string }> = await manager.query(
      'SELECT id FROM users WHERE email = $1 AND id <> $2 LIMIT 1',
      [email, userId],
    );
    return rows.length > 0;
  }

  private async limit(
    scope: string,
    key: string,
    maximum: number,
    window: number,
  ): Promise<void> {
    const result = await this.rates.consume(scope, key, maximum, window);
    if (!result.allowed)
      throw new AuthChallengeException(
        AuthChallengeErrorCode.RATE_LIMITED,
        HttpStatus.TOO_MANY_REQUESTS,
        result.retryAfterSeconds,
      );
  }

  private async ready(): Promise<void> {
    try {
      await this.delivery.assertLiveFlowReady();
    } catch {
      throw new AuthChallengeException(
        AuthChallengeErrorCode.SERVICE_TEMPORARILY_UNAVAILABLE,
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  private continuation(
    challengeId: string,
    expiresAt: Date,
  ): EmailChangeChallengeDto {
    return {
      challenge_id: challengeId,
      expires_in_seconds: Math.max(
        1,
        Math.ceil((expiresAt.getTime() - Date.now()) / 1000),
      ),
      resend_after_seconds: 60,
    };
  }

  private isUniqueViolation(error: unknown): boolean {
    if (!error || typeof error !== 'object') return false;
    if ('code' in error && error.code === '23505') return true;
    if (!('driverError' in error)) return false;
    const cause = error.driverError;
    return Boolean(
      cause &&
      typeof cause === 'object' &&
      'code' in cause &&
      cause.code === '23505',
    );
  }

  private async auditFailure(userId: string, error: unknown): Promise<void> {
    await this.audit.recordAttempt({
      event_type: AuthSecurityEventType.EMAIL_CHANGE,
      outcome:
        error instanceof HttpException && error.getStatus() < 500
          ? AuthSecurityEventOutcome.DENIED
          : AuthSecurityEventOutcome.FAILED,
      actor_user_id: userId,
      subject_user_id: userId,
    });
  }
}
