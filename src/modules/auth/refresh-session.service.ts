import { createHash, randomBytes, randomUUID } from 'node:crypto';

import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { DataSource, EntityManager, IsNull, MoreThan } from 'typeorm';

import { User } from '../user/entities/user.entity';

import { AccountAccessPolicyService } from './account-access-policy.service';
import { AuthSession } from './entities/auth.entity';
import { RefreshCredential } from './entities/refresh-credential.entity';

/** Draft foundation: not registered in AuthModule until #75/#76 integration. */
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
  ) {
    this.secret = config.getOrThrow<string>('JWT_SECRET');
    if (this.secret.trim().length < 32) {
      throw new Error('JWT_SECRET must contain at least 32 characters');
    }
    this.accessSeconds = this.duration(config, 'TOKEN_ACCESS_DURATION', 900);
    this.refreshSeconds = this.duration(
      config,
      'TOKEN_REFRESH_DURATION',
      2592000,
    );
  }

  async issue(userId: string) {
    return this.dataSource.transaction(async (manager) => {
      await this.lockUser(manager, userId);
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
      return this.tokens(session, replacement);
    });
    if (!result) throw this.invalid();
    return result;
  }

  async validate(userId: string, sessionId: string) {
    return this.dataSource.transaction(async (manager) => {
      const user = await this.lockUser(manager, userId);
      const session = await manager.findOneBy(AuthSession, {
        session_id: sessionId,
        user_id: userId,
        credential_version: 2,
        revoked_at: IsNull(),
        expires_at: MoreThan(new Date()),
      });
      if (!session) throw this.invalid();
      return user;
    });
  }

  async revoke(userId: string, sessionId: string) {
    return this.dataSource.transaction(async (manager) => {
      await this.lockUser(manager, userId);
      await manager.update(
        AuthSession,
        {
          session_id: sessionId,
          user_id: userId,
          credential_version: 2,
          revoked_at: IsNull(),
        },
        { revoked_at: new Date() },
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

  private duration(
    config: ConfigService,
    key: string,
    maximum: number,
  ): number {
    const value = config.getOrThrow<string>(key);
    const match = /^(\d+)([smhd]?)$/.exec(value);
    const seconds = match
      ? Number(match[1]) *
        ({ s: 1, m: 60, h: 3600, d: 86400 }[match[2] || 's'] ?? 0)
      : 0;
    if (!Number.isSafeInteger(seconds) || seconds < 1 || seconds > maximum) {
      throw new Error(`${key} must be between 1 and ${maximum} seconds`);
    }
    return seconds;
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
