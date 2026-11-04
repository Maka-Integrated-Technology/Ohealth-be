import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'crypto';

import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { DataSource, EntityManager, IsNull } from 'typeorm';

import * as sysMsg from '../../../constants/system.messages';
import { User } from '../../user/entities/user.entity';
import { AccountAccessPolicyService } from '../account-access-policy.service';
import { AuthSession } from '../entities/auth.entity';
import { RefreshCredential } from '../entities/refresh-credential.entity';
import { AuthSecurityAuditService } from '../security-audit/auth-security-audit.service';
import {
  AuthSecurityEventOutcome,
  AuthSecurityEventType,
} from '../security-audit/auth-security-event.enum';

import { sessionSettings } from './session-settings';

const OPAQUE_REFRESH = /^[A-Za-z0-9_-]{43}$/;

export interface IIssuedSession {
  access_token: string;
  refresh_token: string;
  session_id: string;
  session_expires_at: Date;
}

export interface IValidatedSessionUser {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: string[];
}

@Injectable()
export class RefreshSessionService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly accountPolicy: AccountAccessPolicyService,
    private readonly audit: AuthSecurityAuditService,
  ) {}

  async issue(
    userId: string,
    expectedPasswordHash?: string,
  ): Promise<IIssuedSession> {
    return this.dataSource.transaction(async (manager) => {
      const user = await manager.findOne(User, {
        where: { id: userId },
        lock: { mode: 'pessimistic_write' },
      });
      this.accountPolicy.assertCanAuthenticate(user);
      if (!user) throw new UnauthorizedException(sysMsg.USER_INACTIVE);
      if (
        expectedPasswordHash !== undefined &&
        !this.sameSecret(expectedPasswordHash, user.password)
      ) {
        throw new UnauthorizedException(sysMsg.INVALID_CREDENTIALS);
      }

      const settings = sessionSettings(this.config);
      const now = new Date();
      const expiresAt = new Date(
        now.getTime() + settings.refreshDurationSeconds * 1000,
      );
      const sessionId = randomUUID();
      const refreshToken = this.newRefreshToken();
      const tokenHash = this.hash(refreshToken);

      await manager.insert(AuthSession, {
        session_id: sessionId,
        user_id: user.id,
        refresh_token_hash: tokenHash,
        credential_version: 2,
        last_used_at: now,
        expires_at: expiresAt,
        revoked_at: null,
      });
      await manager.insert(RefreshCredential, {
        token_hash: tokenHash,
        session_id: sessionId,
        created_at: now,
        consumed_at: null,
      });
      await this.audit.recordInTransaction(manager, {
        event_type: AuthSecurityEventType.SIGN_IN,
        outcome: AuthSecurityEventOutcome.SUCCEEDED,
        actor_user_id: user.id,
        subject_user_id: user.id,
        session_id: sessionId,
      });

      return {
        access_token: await this.signAccess(user.id, sessionId),
        refresh_token: refreshToken,
        session_id: sessionId,
        session_expires_at: expiresAt,
      };
    });
  }

  async rotate(
    refreshToken: string,
  ): Promise<IIssuedSession & { userId: string }> {
    if (!OPAQUE_REFRESH.test(refreshToken)) {
      throw new UnauthorizedException(sysMsg.TOKEN_INVALID);
    }
    const tokenHash = this.hash(refreshToken);
    const owner = await this.dataSource
      .getRepository(RefreshCredential)
      .createQueryBuilder('credential')
      .innerJoin(
        AuthSession,
        'session',
        'session.session_id = credential.session_id',
      )
      .select('session.user_id', 'user_id')
      .where('credential.token_hash = :tokenHash', { tokenHash })
      .getRawOne<{ user_id: string }>();
    if (!owner) throw new UnauthorizedException(sysMsg.TOKEN_INVALID);

    const result = await this.dataSource.transaction(async (manager) => {
      const user = await manager.findOne(User, {
        where: { id: owner.user_id },
        lock: { mode: 'pessimistic_write' },
      });
      this.accountPolicy.assertCanAuthenticate(user);
      if (!user) throw new UnauthorizedException(sysMsg.USER_INACTIVE);

      const credential = await manager.findOne(RefreshCredential, {
        where: { token_hash: tokenHash },
        lock: { mode: 'pessimistic_write' },
      });
      if (!credential) return null;
      const session = await manager.findOne(AuthSession, {
        where: { session_id: credential.session_id, user_id: user.id },
        lock: { mode: 'pessimistic_write' },
      });
      if (
        !session ||
        session.credential_version !== 2 ||
        session.revoked_at ||
        session.expires_at <= new Date()
      ) {
        return null;
      }

      if (
        credential.consumed_at ||
        !this.sameSecret(tokenHash, session.refresh_token_hash)
      ) {
        session.revoked_at = new Date();
        await manager.save(session);
        await this.audit.recordInTransaction(manager, {
          event_type: AuthSecurityEventType.SESSION_REUSE,
          outcome: AuthSecurityEventOutcome.DENIED,
          actor_user_id: user.id,
          subject_user_id: user.id,
          session_id: session.session_id,
        });
        return null;
      }

      const now = new Date();
      const replacement = this.newRefreshToken();
      const replacementHash = this.hash(replacement);
      credential.consumed_at = now;
      session.refresh_token_hash = replacementHash;
      session.last_used_at = now;
      await manager.save(credential);
      await manager.save(session);
      await manager.insert(RefreshCredential, {
        token_hash: replacementHash,
        session_id: session.session_id,
        created_at: now,
        consumed_at: null,
      });
      await this.audit.recordInTransaction(manager, {
        event_type: AuthSecurityEventType.SESSION_REFRESH,
        outcome: AuthSecurityEventOutcome.SUCCEEDED,
        actor_user_id: user.id,
        subject_user_id: user.id,
        session_id: session.session_id,
      });
      return {
        userId: user.id,
        access_token: await this.signAccess(user.id, session.session_id),
        refresh_token: replacement,
        session_id: session.session_id,
        session_expires_at: session.expires_at,
      };
    });

    if (!result) throw new UnauthorizedException(sysMsg.TOKEN_INVALID);
    return result;
  }

  async validate(
    userId: string,
    sessionId: string,
  ): Promise<IValidatedSessionUser> {
    const row = await this.dataSource
      .getRepository(User)
      .createQueryBuilder('user')
      .innerJoin(
        AuthSession,
        'session',
        'session.user_id = user.id AND session.session_id = :sessionId',
        { sessionId },
      )
      .select([
        'user.id',
        'user.email',
        'user.first_name',
        'user.last_name',
        'user.role',
        'user.account_status',
        'user.email_verified_at',
        'user.is_active',
        'user.is_verified',
      ])
      .where('user.id = :userId', { userId })
      .andWhere('session.credential_version = 2')
      .andWhere('session.revoked_at IS NULL')
      .andWhere('session.expires_at > CURRENT_TIMESTAMP')
      .getOne();
    this.accountPolicy.assertCanAuthenticate(row);
    if (!row) throw new UnauthorizedException(sysMsg.TOKEN_INVALID);
    return row;
  }

  async revoke(userId: string, sessionId: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const user = await manager.findOne(User, {
        where: { id: userId },
        lock: { mode: 'pessimistic_write' },
      });
      this.accountPolicy.assertCanAuthenticate(user);
      if (!user) throw new UnauthorizedException(sysMsg.USER_INACTIVE);
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
      if (result.affected) {
        await this.audit.recordInTransaction(manager, {
          event_type: AuthSecurityEventType.LOGOUT,
          outcome: AuthSecurityEventOutcome.SUCCEEDED,
          actor_user_id: userId,
          subject_user_id: userId,
          session_id: sessionId,
        });
      }
    });
  }

  async revokeAll(userId: string): Promise<void> {
    await this.dataSource.transaction((manager) =>
      this.revokeAllInTransaction(manager, userId),
    );
  }

  async revokeAllInTransaction(
    manager: EntityManager,
    userId: string,
  ): Promise<void> {
    if (!manager.queryRunner?.isTransactionActive) {
      throw new Error('Session revocation requires an active transaction.');
    }
    const user = await manager.findOne(User, {
      where: { id: userId },
      lock: { mode: 'pessimistic_write' },
    });
    this.accountPolicy.assertCanAuthenticate(user);
    if (!user) throw new UnauthorizedException(sysMsg.USER_INACTIVE);
    await manager.update(
      AuthSession,
      { user_id: userId, revoked_at: IsNull() },
      { revoked_at: new Date() },
    );
    await this.audit.recordInTransaction(manager, {
      event_type: AuthSecurityEventType.LOGOUT,
      outcome: AuthSecurityEventOutcome.SUCCEEDED,
      actor_user_id: userId,
      subject_user_id: userId,
    });
  }

  async replacePassword(
    userId: string,
    expectedPasswordHash: string,
    newPasswordHash: string,
  ): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const user = await manager.findOne(User, {
        where: { id: userId },
        lock: { mode: 'pessimistic_write' },
      });
      this.accountPolicy.assertCanAuthenticate(user);
      if (!user || !this.sameSecret(expectedPasswordHash, user.password)) {
        throw new UnauthorizedException(sysMsg.INVALID_CURRENT_PASSWORD);
      }
      await manager.update(User, user.id, { password: newPasswordHash });
      await manager.update(
        AuthSession,
        { user_id: user.id, revoked_at: IsNull() },
        { revoked_at: new Date() },
      );
      await this.audit.recordInTransaction(manager, {
        event_type: AuthSecurityEventType.PASSWORD_CHANGE,
        outcome: AuthSecurityEventOutcome.SUCCEEDED,
        actor_user_id: user.id,
        subject_user_id: user.id,
      });
    });
  }

  async list(userId: string): Promise<AuthSession[]> {
    return this.dataSource
      .getRepository(AuthSession)
      .find({
        select: ['session_id', 'created_at', 'last_used_at', 'expires_at'],
        where: {
          user_id: userId,
          credential_version: 2,
          revoked_at: IsNull(),
        },
        order: { created_at: 'DESC' },
      })
      .then((sessions) =>
        sessions.filter((session) => session.expires_at > new Date()),
      );
  }

  private newRefreshToken(): string {
    return randomBytes(32).toString('base64url');
  }

  private hash(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }

  private sameSecret(left: string, right: string): boolean {
    const leftBuffer = Buffer.from(left);
    const rightBuffer = Buffer.from(right);
    return (
      leftBuffer.length === rightBuffer.length &&
      timingSafeEqual(leftBuffer, rightBuffer)
    );
  }

  private async signAccess(userId: string, sessionId: string): Promise<string> {
    const settings = sessionSettings(this.config);
    return this.jwt.signAsync(
      { sub: userId, sid: sessionId, jti: randomUUID() },
      {
        algorithm: 'HS256',
        secret: settings.jwtSecret,
        expiresIn: settings.accessDurationSeconds,
      },
    );
  }
}
