import { createHash, randomBytes, randomUUID } from 'node:crypto';

import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { DataSource, EntityManager, IsNull, MoreThan } from 'typeorm';

import { User } from '../user/entities/user.entity';

import { AccountAccessPolicyService } from './account-access-policy.service';
import { AuthSession } from './entities/auth.entity';
import { RefreshCredential } from './entities/refresh-credential.entity';
import { AuthSecurityAuditService } from './security-audit/auth-security-audit.service';
import {
  AuthSecurityEventType,
  AuthSecurityEventOutcome,
} from './security-audit/auth-security-event.enum';
import { sessionSettings } from './session-settings';

/** Canonical persisted sessions. One stable session ID is one refresh family. */
@Injectable()
export class RefreshSessionService {
  private readonly secret: string;
  private readonly accessSeconds: number;
  private readonly refreshSeconds: number;

  constructor(
    private readonly dataSource: DataSource,
    private readonly jwt: JwtService,
    config: ConfigService,
    private readonly accountPolicy: AccountAccessPolicyService,
    private readonly audit: AuthSecurityAuditService,
  ) {
    const settings = sessionSettings(config);
    this.secret = settings.secret;
    this.accessSeconds = settings.accessSeconds;
    this.refreshSeconds = settings.refreshSeconds;
  }

  async issue(userId: string, expectedPassword?: string) {
    return this.dataSource.transaction(async (manager) => {
      const user = await this.lockUser(manager, userId);
      // Reject a password proof invalidated by a concurrent reset/change.
      if (expectedPassword !== undefined && user.password !== expectedPassword)
        throw this.invalid();
      const now = new Date();
      const token = this.newToken();
      const session = await manager.save(
        AuthSession,
        manager.create(AuthSession, {
          session_id: randomUUID(),
          user_id: userId,
          credential_version: 2,
          refresh_token_hash: this.hash(token),
          expires_at: new Date(now.getTime() + this.refreshSeconds * 1000),
          last_used_at: now,
          revoked_at: null,
        }),
      );
      await this.storeCredential(manager, session.session_id, token, now);
      await this.record(
        manager,
        userId,
        session.session_id,
        AuthSecurityEventType.SIGN_IN,
      );
      return this.tokens(session, token);
    });
  }

  async rotate(token: string) {
    this.assertToken(token);
    // This immutable lookup only identifies the lock owner; all security state
    // is re-read under locks, consistently ordered user -> family -> credential.
    const credential = await this.dataSource
      .getRepository(RefreshCredential)
      .findOneBy({
        token_hash: this.hash(token),
      });
    if (!credential) throw this.invalid();
    const owner = await this.dataSource.getRepository(AuthSession).findOneBy({
      session_id: credential.session_id,
    });
    if (!owner) throw this.invalid();

    const result = await this.dataSource.transaction(async (manager) => {
      await this.lockUser(manager, owner.user_id);
      const session = await manager.findOne(AuthSession, {
        where: { session_id: credential.session_id, credential_version: 2 },
        lock: { mode: 'pessimistic_write' },
      });
      if (!session || session.revoked_at || session.expires_at <= new Date())
        return null;
      const current = await manager.findOneBy(RefreshCredential, {
        token_hash: this.hash(token),
      });
      if (!current || current.session_id !== session.session_id) return null;
      if (
        current.consumed_at ||
        session.refresh_token_hash !== current.token_hash
      ) {
        session.revoked_at = new Date();
        await manager.save(session);
        await this.record(
          manager,
          owner.user_id,
          session.session_id,
          AuthSecurityEventType.SESSION_REUSE,
          AuthSecurityEventOutcome.DENIED,
        );
        // Return instead of throwing: revocation must COMMIT before the 401.
        return null;
      }
      const now = new Date();
      current.consumed_at = now;
      await manager.save(current);
      const replacement = this.newToken();
      session.refresh_token_hash = this.hash(replacement);
      session.last_used_at = now;
      await manager.save(session);
      await this.storeCredential(manager, session.session_id, replacement, now);
      await this.record(
        manager,
        owner.user_id,
        session.session_id,
        AuthSecurityEventType.SESSION_REFRESH,
      );
      return {
        ...(await this.tokens(session, replacement)),
        userId: owner.user_id,
      };
    });
    if (!result) throw this.invalid();
    return result;
  }

  async validate(userId: string, sessionId: string) {
    // A single MVCC statement sees account and session from one snapshot.
    // Ordinary authenticated traffic must not lock user rows or serialize reads.
    const user = await this.dataSource
      .getRepository(User)
      .createQueryBuilder('user')
      .select([
        'user.id',
        'user.email',
        'user.first_name',
        'user.last_name',
        'user.role',
        'user.account_status',
        'user.email_verified_at',
      ])
      .innerJoin(AuthSession, 'session', 'session.user_id = user.id')
      .where('user.id = :userId AND session.session_id = :sessionId', {
        userId,
        sessionId,
      })
      .andWhere('session.credential_version = 2 AND session.revoked_at IS NULL')
      .andWhere('session.expires_at > CURRENT_TIMESTAMP')
      .getOne();
    this.accountPolicy.assertCanAuthenticate(user);
    if (!user) throw this.invalid();
    return user;
  }

  async revoke(userId: string, sessionId: string) {
    return this.dataSource.transaction(async (manager) => {
      await this.lockUser(manager, userId);
      const result = await manager.update(
        AuthSession,
        {
          session_id: sessionId,
          user_id: userId,
          credential_version: 2,
          revoked_at: IsNull(),
        },
        { revoked_at: new Date() },
      );
      if (result.affected)
        await this.record(
          manager,
          userId,
          sessionId,
          AuthSecurityEventType.LOGOUT,
        );
    });
  }

  /** Caller must hold the user FOR UPDATE lock in the credential-change transaction.
   * The shared lock serializes issuance/rotation with password reset and revoke-all.
   */
  async revokeAllInTransaction(manager: EntityManager, userId: string) {
    if (!manager.queryRunner?.isTransactionActive) {
      throw new Error('Session revocation requires an active transaction');
    }
    await manager.findOneOrFail(User, {
      where: { id: userId },
      lock: { mode: 'pessimistic_write' },
    });
    await manager.update(
      AuthSession,
      { user_id: userId, revoked_at: IsNull() },
      { revoked_at: new Date() },
    );
  }

  async list(userId: string) {
    return this.dataSource.getRepository(AuthSession).find({
      where: {
        user_id: userId,
        credential_version: 2,
        revoked_at: IsNull(),
        expires_at: MoreThan(new Date()),
      },
      select: {
        session_id: true,
        created_at: true,
        last_used_at: true,
        expires_at: true,
      },
      order: { created_at: 'DESC' },
    });
  }

  private async lockUser(manager: EntityManager, userId: string) {
    const user = await manager.findOne(User, {
      where: { id: userId },
      lock: { mode: 'pessimistic_write' },
    });
    this.accountPolicy.assertCanAuthenticate(user);
    return user!;
  }

  private async storeCredential(
    manager: EntityManager,
    sessionId: string,
    token: string,
    now: Date,
  ) {
    await manager.insert(RefreshCredential, {
      token_hash: this.hash(token),
      session_id: sessionId,
      created_at: now,
      consumed_at: null,
    });
  }

  private async tokens(session: AuthSession, token: string) {
    return {
      access_token: await this.jwt.signAsync(
        { sub: session.user_id, sid: session.session_id, jti: randomUUID() },
        {
          secret: this.secret,
          algorithm: 'HS256',
          expiresIn: this.accessSeconds,
        },
      ),
      refresh_token: token,
      session_id: session.session_id,
      session_expires_at: session.expires_at,
    };
  }

  async revokeAll(userId: string) {
    await this.dataSource.transaction(async (manager) => {
      await this.revokeAllInTransaction(manager, userId);
      await this.record(manager, userId, null, AuthSecurityEventType.LOGOUT);
    });
  }

  async replacePassword(
    userId: string,
    expectedPassword: string,
    password: string,
  ) {
    await this.dataSource.transaction(async (manager) => {
      const user = await this.lockUser(manager, userId);
      if (user.password !== expectedPassword) throw this.invalid();
      await manager.update(User, userId, { password });
      await this.revokeAllInTransaction(manager, userId);
      await this.record(
        manager,
        userId,
        null,
        AuthSecurityEventType.PASSWORD_CHANGE,
      );
    });
  }

  private async record(
    manager: EntityManager,
    userId: string,
    sessionId: string | null,
    eventType: AuthSecurityEventType,
    outcome = AuthSecurityEventOutcome.SUCCEEDED,
  ) {
    await this.audit.recordInTransaction(manager, {
      event_type: eventType,
      outcome,
      actor_user_id: userId,
      subject_user_id: userId,
      session_id: sessionId,
    });
  }

  private newToken() {
    return randomBytes(32).toString('base64url');
  }
  private hash(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }
  private assertToken(token: string) {
    if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(token))
      throw this.invalid();
  }
  private invalid() {
    return new UnauthorizedException('Invalid session credential');
  }
}
