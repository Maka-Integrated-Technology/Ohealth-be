import { randomBytes } from 'node:crypto';

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource, EntityManager } from 'typeorm';

import { UserPersonaType } from '../../identity/enums/user-persona-type.enum';
import { User } from '../../user/entities/user.entity';
import { AccountStatus } from '../../user/enums/account-status.enum';
import { OutboxEvent } from '../../platform-events/entities/outbox-event.entity';
import { AccountAccessPolicyService } from '../account-access-policy.service';
import { AuthRoutingService } from '../auth-routing.service';
import { AuthChallengeDeliveryService } from '../challenges/auth-challenge-delivery.service';
import { AuthChallengePurpose } from '../challenges/auth-challenge.entity';
import { AuthSession } from '../entities/auth.entity';
import { SignupIntent } from '../enums/signup-intent.enum';
import { PasswordCredentialsService } from '../password-policy/password-credentials.service';
import { AccountProvisioningService } from '../registration/account-provisioning.service';
import { AuthSecurityAuditService } from '../security-audit/auth-security-audit.service';
import {
  AuthSecurityEventOutcome,
  AuthSecurityEventType,
} from '../security-audit/auth-security-event.enum';
import { RefreshSessionService } from '../sessions/refresh-session.service';

import { ExternalIdentity } from './external-identity.entity';
import {
  GoogleTokenVerifierService,
  IVerifiedGoogleIdentity,
} from './google-token-verifier.service';
import { OAuthTransactionService } from './oauth-transaction.service';
import { CompleteGoogleOAuthDto, StartGoogleOAuthDto } from './oauth.dto';
import { OAuthConsumer, OAuthOperation, OAuthProvider } from './oauth.enums';
import { OAuthException } from './oauth.error';

const RECENT_AUTH_MS = 10 * 60 * 1000;

@Injectable()
export class OAuthService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly config: ConfigService,
    private readonly transactions: OAuthTransactionService,
    private readonly verifier: GoogleTokenVerifierService,
    private readonly sessions: RefreshSessionService,
    private readonly routing: AuthRoutingService,
    private readonly passwords: PasswordCredentialsService,
    private readonly provisioning: AccountProvisioningService,
    private readonly delivery: AuthChallengeDeliveryService,
    private readonly audit: AuthSecurityAuditService,
    private readonly accountPolicy: AccountAccessPolicyService,
  ) {}

  async start(dto: StartGoogleOAuthDto) {
    if (dto.operation === OAuthOperation.LINK) {
      throw new OAuthException('OAUTH_RECENT_AUTH_REQUIRED');
    }
    if (
      dto.operation === OAuthOperation.SIGNIN &&
      (dto.intent !== undefined ||
        dto.accepted_terms_version !== undefined ||
        dto.accepted_privacy_version !== undefined)
    ) {
      throw new OAuthException('OAUTH_TRANSACTION_INVALID');
    }
    if (dto.operation === OAuthOperation.SIGNUP) {
      this.assertSupportedIntent(dto.intent);
      this.assertCurrentLegalVersions(
        dto.accepted_terms_version,
        dto.accepted_privacy_version,
      );
    }
    return this.transactions.start({
      operation: dto.operation,
      consumer: dto.consumer,
      audience: dto.audience,
      intent: dto.intent,
      acceptedTermsVersion: dto.accepted_terms_version,
      acceptedPrivacyVersion: dto.accepted_privacy_version,
    });
  }

  async startLink(
    userId: string,
    sessionId: string,
    consumer: OAuthConsumer,
    audience: string,
  ) {
    await this.assertRecentSession(userId, sessionId);
    return this.transactions.start({
      operation: OAuthOperation.LINK,
      consumer,
      audience,
      userId,
      sessionId,
    });
  }

  async complete(dto: CompleteGoogleOAuthDto) {
    this.transactions.assertReady();
    try {
      return await this.completeVerified(dto);
    } catch (error) {
      const safeError =
        error instanceof OAuthException
          ? error
          : (error as { code?: string })?.code === '23505'
            ? new OAuthException('OAUTH_IDENTITY_CONFLICT')
            : new OAuthException('OAUTH_AUTHENTICATION_FAILED');
      const eventType =
        safeError.errorCode === 'OAUTH_IDENTITY_CONFLICT'
          ? AuthSecurityEventType.OAUTH_CONFLICT
          : AuthSecurityEventType.OAUTH_DENIAL;
      await this.audit.recordAttempt({
        event_type: eventType,
        outcome: AuthSecurityEventOutcome.DENIED,
      });
      throw safeError;
    }
  }

  private async completeVerified(dto: CompleteGoogleOAuthDto) {
    const preview = await this.transactions.load(
      dto.transaction_id,
      dto.transaction_token,
    );
    // Claim first so every completion attempt, including an invalid provider
    // proof, burns the one-time transaction and cannot be brute-forced.
    const transaction = await this.dataSource.transaction((manager) =>
      this.transactions.consumeInTransaction(
        manager,
        dto.transaction_id,
        dto.transaction_token,
      ),
    );
    if (
      transaction.audience !== preview.audience ||
      transaction.nonce_hash !== preview.nonce_hash
    ) {
      throw new OAuthException('OAUTH_TRANSACTION_INVALID');
    }
    const proof = await this.verifier.verify(
      dto.id_token,
      transaction.audience,
      transaction.nonce_hash,
    );

    const result = await this.dataSource.transaction(async (manager) => {
      if (transaction.operation === OAuthOperation.SIGNIN) {
        return this.signIn(manager, proof);
      }
      if (transaction.operation === OAuthOperation.SIGNUP) {
        this.assertSupportedIntent(transaction.intent ?? undefined);
        this.assertCurrentLegalVersions(
          transaction.accepted_terms_version ?? undefined,
          transaction.accepted_privacy_version ?? undefined,
        );
        return this.signUp(manager, transaction, proof);
      }
      if (!transaction.user_id || !transaction.session_id) {
        throw new OAuthException('OAUTH_TRANSACTION_INVALID');
      }
      return this.link(
        manager,
        transaction.user_id,
        transaction.session_id,
        proof,
      );
    });

    const routed = result as typeof result & { user?: User };
    if (routed.user) {
      return { ...result, ...(await this.routing.resolve(routed.user)) };
    }
    return result;
  }

  async unlink(
    userId: string,
    sessionId: string,
  ): Promise<{ message: string }> {
    try {
      await this.dataSource.transaction(async (manager) => {
        const user = await manager.findOne(User, {
          where: { id: userId },
          lock: { mode: 'pessimistic_write' },
        });
        if (!user) throw new OAuthException('OAUTH_AUTHENTICATION_FAILED');
        this.assertAccount(user);
        await this.assertRecentSession(userId, sessionId, manager);
        const identities = await manager.find(ExternalIdentity, {
          where: { user_id: userId },
        });
        if (
          !identities.some(
            (identity) => identity.provider === OAuthProvider.GOOGLE,
          )
        ) {
          throw new OAuthException('OAUTH_IDENTITY_CONFLICT');
        }
        if (!user.password_authentication_enabled && identities.length <= 1) {
          throw new OAuthException('OAUTH_LAST_AUTHENTICATOR');
        }
        const deleted = await manager.delete(ExternalIdentity, {
          user_id: userId,
          provider: OAuthProvider.GOOGLE,
        });
        if (deleted.affected !== 1)
          throw new OAuthException('OAUTH_IDENTITY_CONFLICT');
        await this.sessions.revokeAllInTransaction(manager, userId);
        await manager.insert(OutboxEvent, {
          aggregate_type: 'user',
          aggregate_id: userId,
          event_type: 'oauth_google_unlinked',
          payload: { user_id: userId },
        });
        await this.audit.recordInTransaction(manager, {
          event_type: AuthSecurityEventType.OAUTH_UNLINK,
          outcome: AuthSecurityEventOutcome.SUCCEEDED,
          actor_user_id: userId,
          subject_user_id: userId,
          session_id: sessionId,
        });
      });
      return { message: 'Google identity unlinked.' };
    } catch (error) {
      const safeError =
        error instanceof OAuthException
          ? error
          : new OAuthException('OAUTH_AUTHENTICATION_FAILED');
      await this.audit.recordAttempt({
        event_type: AuthSecurityEventType.OAUTH_DENIAL,
        outcome: AuthSecurityEventOutcome.DENIED,
        actor_user_id: userId,
        subject_user_id: userId,
        session_id: sessionId,
      });
      throw safeError;
    }
  }

  private async signIn(manager: EntityManager, proof: IVerifiedGoogleIdentity) {
    const identity = await manager.findOne(ExternalIdentity, {
      where: { issuer: proof.issuer, subject: proof.subject },
    });
    if (!identity) {
      const emailOwner = await manager
        .createQueryBuilder(User, 'user')
        .where('lower(btrim(user.email)) = :email', { email: proof.email })
        .getOne();
      await this.audit.recordInTransaction(manager, {
        event_type: AuthSecurityEventType.OAUTH_SIGN_IN,
        outcome: AuthSecurityEventOutcome.DENIED,
      });
      throw new OAuthException(
        emailOwner ? 'OAUTH_ACCOUNT_LINK_REQUIRED' : 'OAUTH_SIGNUP_REQUIRED',
      );
    }
    const user = await manager.findOne(User, {
      where: { id: identity.user_id },
      lock: { mode: 'pessimistic_write' },
    });
    if (!user) throw new OAuthException('OAUTH_AUTHENTICATION_FAILED');
    const session = await this.sessions.issueInTransaction(manager, user.id);
    await manager.update(ExternalIdentity, identity.id, {
      last_authenticated_at: new Date(),
    });
    await this.audit.recordInTransaction(manager, {
      event_type: AuthSecurityEventType.OAUTH_SIGN_IN,
      outcome: AuthSecurityEventOutcome.SUCCEEDED,
      actor_user_id: user.id,
      subject_user_id: user.id,
      session_id: session.session_id,
    });
    return {
      message: 'Login successful',
      user: this.safeUser(user),
      ...session,
    };
  }

  private async signUp(
    manager: EntityManager,
    transaction: {
      intent: SignupIntent | null;
      accepted_terms_version: string | null;
      accepted_privacy_version: string | null;
    },
    proof: IVerifiedGoogleIdentity,
  ) {
    const linked = await manager.findOne(ExternalIdentity, {
      where: { issuer: proof.issuer, subject: proof.subject },
    });
    if (linked) throw new OAuthException('OAUTH_IDENTITY_CONFLICT');
    const emailOwner = await manager
      .createQueryBuilder(User, 'user')
      .where('lower(btrim(user.email)) = :email', { email: proof.email })
      .getOne();
    if (emailOwner) throw new OAuthException('OAUTH_ACCOUNT_LINK_REQUIRED');

    const authoritative =
      proof.email.endsWith('@gmail.com') || Boolean(proof.hostedDomain);
    const generatedSecret = randomBytes(32).toString('base64url');
    const password = await this.passwords.hashGeneratedSecret(generatedSecret);
    const persona =
      transaction.intent === SignupIntent.HEALTHCARE_PROFESSIONAL
        ? UserPersonaType.HEALTHCARE_PROFESSIONAL
        : UserPersonaType.PATIENT;
    const user = await this.provisioning.provisionPersonaAndLegalIdentity(
      manager,
      {
        email: proof.email,
        password,
        passwordAuthenticationEnabled: false,
        firstName: this.safeName(proof.givenName, 'OHealth'),
        lastName: this.safeName(proof.familyName, 'User'),
        accountStatus: authoritative
          ? AccountStatus.ACTIVE
          : AccountStatus.PENDING_VERIFICATION,
        emailVerifiedAt: authoritative ? new Date() : null,
        personaType: persona,
        acceptedTermsVersion: transaction.accepted_terms_version!,
        acceptedPrivacyVersion: transaction.accepted_privacy_version!,
        acceptedAt: new Date(),
      },
    );
    await manager.insert(ExternalIdentity, {
      user_id: user.id,
      provider: OAuthProvider.GOOGLE,
      issuer: proof.issuer,
      subject: proof.subject,
      last_authenticated_at: authoritative ? new Date() : null,
    });
    await this.audit.recordInTransaction(manager, {
      event_type: AuthSecurityEventType.OAUTH_SIGNUP,
      outcome: AuthSecurityEventOutcome.SUCCEEDED,
      subject_user_id: user.id,
    });

    if (!authoritative) {
      const challenge = await this.delivery.queueInTransaction(
        manager,
        user,
        AuthChallengePurpose.CONTACT_VERIFICATION,
      );
      return {
        message: 'Contact verification required.',
        error_code: 'OAUTH_CONTACT_VERIFICATION_REQUIRED',
        challenge_id: challenge.challengeId,
        resend_after_seconds: challenge.resendAfterSeconds,
        expires_in_seconds: challenge.expiresInSeconds,
      };
    }
    const session = await this.sessions.issueInTransaction(manager, user.id);
    return {
      message: 'Login successful',
      user: this.safeUser(user),
      ...session,
    };
  }

  private async link(
    manager: EntityManager,
    userId: string,
    sessionId: string,
    proof: IVerifiedGoogleIdentity,
  ) {
    const user = await manager.findOne(User, {
      where: { id: userId },
      lock: { mode: 'pessimistic_write' },
    });
    if (!user) throw new OAuthException('OAUTH_AUTHENTICATION_FAILED');
    this.assertAccount(user);
    await this.assertRecentSession(userId, sessionId, manager);
    if (user.email.trim().toLowerCase() !== proof.email.trim().toLowerCase()) {
      throw new OAuthException('OAUTH_ACCOUNT_LINK_REQUIRED');
    }
    const subjectOwner = await manager.findOne(ExternalIdentity, {
      where: { issuer: proof.issuer, subject: proof.subject },
    });
    if (subjectOwner && subjectOwner.user_id !== userId) {
      throw new OAuthException('OAUTH_IDENTITY_CONFLICT');
    }
    const existing = await manager.findOne(ExternalIdentity, {
      where: { user_id: userId, provider: OAuthProvider.GOOGLE },
    });
    if (!existing) {
      await manager.insert(ExternalIdentity, {
        user_id: userId,
        provider: OAuthProvider.GOOGLE,
        issuer: proof.issuer,
        subject: proof.subject,
      });
    } else if (existing.subject !== proof.subject) {
      throw new OAuthException('OAUTH_IDENTITY_CONFLICT');
    }
    await this.audit.recordInTransaction(manager, {
      event_type: AuthSecurityEventType.OAUTH_LINK,
      outcome: AuthSecurityEventOutcome.SUCCEEDED,
      actor_user_id: userId,
      subject_user_id: userId,
    });
    return { message: 'Google identity linked.' };
  }

  private async assertRecentSession(
    userId: string,
    sessionId: string,
    manager?: EntityManager,
  ) {
    const cutoff = new Date(Date.now() - RECENT_AUTH_MS);
    const session = manager
      ? await manager.findOne(AuthSession, {
          where: { user_id: userId, session_id: sessionId },
          lock: { mode: 'pessimistic_write' },
        })
      : await this.dataSource
          .getRepository(AuthSession)
          .findOne({ where: { user_id: userId, session_id: sessionId } });
    if (
      !session ||
      session.revoked_at ||
      session.expires_at <= new Date() ||
      session.created_at < cutoff ||
      session.credential_version !== 2
    ) {
      throw new OAuthException('OAUTH_RECENT_AUTH_REQUIRED');
    }
    if (!manager) {
      const user = await this.dataSource
        .getRepository(User)
        .findOne({ where: { id: userId } });
      this.assertAccount(user);
    }
  }

  private assertAccount(user: User | null): void {
    try {
      this.accountPolicy.assertCanAuthenticate(user);
    } catch {
      throw new OAuthException('OAUTH_AUTHENTICATION_FAILED');
    }
  }

  private assertSupportedIntent(intent?: SignupIntent): void {
    if (
      intent !== SignupIntent.PATIENT &&
      intent !== SignupIntent.HEALTHCARE_PROFESSIONAL
    ) {
      throw new OAuthException('OAUTH_INTENT_NOT_SUPPORTED');
    }
  }

  private assertCurrentLegalVersions(terms?: string, privacy?: string): void {
    if (
      terms !== this.config.get<string>('registration.termsVersion') ||
      privacy !== this.config.get<string>('registration.privacyVersion')
    ) {
      throw new OAuthException('OAUTH_LEGAL_VERSION_STALE');
    }
  }

  private safeName(value: string | undefined, fallback: string): string {
    const cleaned = value
      ?.normalize('NFC')
      .trim()
      .replace(/[\u0000-\u001f\u007f]/g, '');
    return cleaned?.slice(0, 100) || fallback;
  }

  private safeUser(user: User) {
    return {
      id: user.id,
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
    };
  }
}
