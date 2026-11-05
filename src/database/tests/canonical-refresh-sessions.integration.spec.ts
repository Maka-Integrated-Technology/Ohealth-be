/* eslint-disable @typescript-eslint/naming-convention */
import { createHash, randomUUID } from 'node:crypto';
import { env } from 'node:process';

import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { DataSource } from 'typeorm';

import { AccountAccessPolicyService } from '../../modules/auth/account-access-policy.service';
import { AuthSession } from '../../modules/auth/entities/auth.entity';
import { RefreshCredential } from '../../modules/auth/entities/refresh-credential.entity';
import { AuthSecurityAuditService } from '../../modules/auth/security-audit/auth-security-audit.service';
import { RefreshSessionService } from '../../modules/auth/sessions/refresh-session.service';
import { User } from '../../modules/user/entities/user.entity';
import { AccountStatus } from '../../modules/user/enums/account-status.enum';
import { CanonicalRefreshSessions1793400000000 } from '../migrations/1793400000000-CanonicalRefreshSessions';

const integration = env.PG_INTEGRATION_URL ? describe : describe.skip;

integration('Canonical refresh sessions on real PostgreSQL', () => {
  let admin: DataSource;
  let dataSource: DataSource;
  let service: RefreshSessionService;
  let databaseName: string;

  const config = new ConfigService({
    JWT_SECRET: 'issue-77-test-secret-that-is-at-least-32-characters',
    TOKEN_ACCESS_DURATION: '15m',
    TOKEN_REFRESH_DURATION: '7d',
  });

  beforeAll(async () => {
    const baseUrl = new URL(env.PG_INTEGRATION_URL!);
    databaseName = `sessions_${randomUUID().replaceAll('-', '')}`;
    admin = new DataSource({ type: 'postgres', url: baseUrl.toString() });
    await admin.initialize();
    await admin.query(`CREATE DATABASE "${databaseName}"`);
    baseUrl.pathname = `/${databaseName}`;
    dataSource = new DataSource({
      type: 'postgres',
      url: baseUrl.toString(),
      entities: [__dirname + '/../../modules/**/*.entity.ts'],
      migrations: [__dirname + '/../migrations/*.ts'],
      migrationsTableName: 'migrations',
      synchronize: false,
    });
    await dataSource.initialize();
    await dataSource.runMigrations();
    service = new RefreshSessionService(
      dataSource,
      new JwtService(),
      config,
      new AccountAccessPolicyService(),
      new AuthSecurityAuditService(dataSource),
    );
  });

  afterEach(async () => {
    await dataSource.query('DELETE FROM users');
  });

  afterAll(async () => {
    if (dataSource?.isInitialized) await dataSource.destroy();
    if (admin?.isInitialized) {
      await admin.query(`DROP DATABASE IF EXISTS "${databaseName}"`);
      await admin.destroy();
    }
  });

  it('stores only a refresh hash and binds a short access token to the session', async () => {
    const user = await createUser();
    const issued = await service.issue(user.id, user.password);

    expect(issued.refresh_token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const session = await dataSource
      .getRepository(AuthSession)
      .findOneByOrFail({
        session_id: issued.session_id,
      });
    expect(session.refresh_token_hash).toBe(sha256(issued.refresh_token));
    expect(JSON.stringify(session)).not.toContain(issued.refresh_token);
    const credential = await dataSource
      .getRepository(RefreshCredential)
      .findOneByOrFail({ token_hash: session.refresh_token_hash });
    expect(credential.consumed_at).toBeNull();

    const payload = await new JwtService().verifyAsync<{
      sub: string;
      sid: string;
      jti: string;
      iat: number;
      exp: number;
      role?: unknown;
      email?: unknown;
    }>(issued.access_token, { secret: config.get('JWT_SECRET') });
    expect(payload).toMatchObject({ sub: user.id, sid: issued.session_id });
    expect(payload.jti).toMatch(/^[0-9a-f-]{36}$/);
    expect(payload.exp - payload.iat).toBeLessThanOrEqual(900);
    expect(payload.role).toBeUndefined();
    expect(payload.email).toBeUndefined();
  });

  it('rotates atomically, keeps the family id and revokes the family on replay', async () => {
    const user = await createUser();
    const issued = await service.issue(user.id, user.password);
    const rotated = await service.rotate(issued.refresh_token);

    expect(rotated.session_id).toBe(issued.session_id);
    expect(rotated.session_expires_at).toEqual(issued.session_expires_at);
    expect(rotated.refresh_token).not.toBe(issued.refresh_token);
    await expect(service.rotate(issued.refresh_token)).rejects.toThrow();
    const session = await dataSource
      .getRepository(AuthSession)
      .findOneByOrFail({
        session_id: issued.session_id,
      });
    expect(session.revoked_at).toBeInstanceOf(Date);
    await expect(service.rotate(rotated.refresh_token)).rejects.toThrow();
  });

  it('allows at most one concurrent rotation and records the replay revocation', async () => {
    const user = await createUser();
    const issued = await service.issue(user.id, user.password);
    const outcomes = await Promise.allSettled(
      Array.from({ length: 8 }, () => service.rotate(issued.refresh_token)),
    );
    expect(
      outcomes.filter((outcome) => outcome.status === 'fulfilled'),
    ).toHaveLength(1);
    expect(
      outcomes.filter((outcome) => outcome.status === 'rejected'),
    ).toHaveLength(7);
    const session = await dataSource
      .getRepository(AuthSession)
      .findOneByOrFail({
        session_id: issued.session_id,
      });
    expect(session.revoked_at).toBeInstanceOf(Date);
  });

  it('prevents cross-user revocation and validates current account/session state', async () => {
    const owner = await createUser();
    const stranger = await createUser();
    const issued = await service.issue(owner.id, owner.password);

    await service.revoke(stranger.id, issued.session_id);
    await expect(
      service.validate(owner.id, issued.session_id),
    ).resolves.toMatchObject({
      id: owner.id,
    });
    await service.revoke(owner.id, issued.session_id);
    await expect(
      service.validate(owner.id, issued.session_id),
    ).rejects.toThrow();
  });

  it('validates without waiting for a writer holding the user row', async () => {
    const user = await createUser();
    const issued = await service.issue(user.id, user.password);
    const writer = dataSource.createQueryRunner();
    await writer.connect();
    await writer.startTransaction();
    try {
      await writer.query('SELECT id FROM users WHERE id = $1 FOR UPDATE', [
        user.id,
      ]);
      const result = await Promise.race([
        service.validate(user.id, issued.session_id),
        new Promise<never>((_, reject) => {
          setTimeout(
            () => reject(new Error('validation waited on writer')),
            500,
          );
        }),
      ]);
      expect(result.id).toBe(user.id);
    } finally {
      await writer.rollbackTransaction();
      await writer.release();
    }
  });

  it('changes the password and revokes sessions in one audited transaction', async () => {
    const user = await createUser();
    const first = await service.issue(user.id, user.password);
    const second = await service.issue(user.id, user.password);
    await service.replacePassword(user.id, user.password, 'new-password-hash');

    const stored = await dataSource
      .getRepository(User)
      .findOneByOrFail({ id: user.id });
    expect(stored.password).toBe('new-password-hash');
    await expect(service.validate(user.id, first.session_id)).rejects.toThrow();
    await expect(
      service.validate(user.id, second.session_id),
    ).rejects.toThrow();
  });

  it('rejects issuance from a stale password proof', async () => {
    const user = await createUser();
    await expect(
      service.issue(user.id, 'stale-password-hash'),
    ).rejects.toThrow();
    expect(await dataSource.getRepository(AuthSession).count()).toBe(0);
  });

  it('rolls session issuance back when its security audit cannot be written', async () => {
    const user = await createUser();
    const failingService = new RefreshSessionService(
      dataSource,
      new JwtService(),
      config,
      new AccountAccessPolicyService(),
      {
        recordInTransaction: async () => {
          throw new Error('audit unavailable');
        },
      } as unknown as AuthSecurityAuditService,
    );
    await expect(failingService.issue(user.id, user.password)).rejects.toThrow(
      'audit unavailable',
    );
    expect(await dataSource.getRepository(AuthSession).count()).toBe(0);
  });

  it('forces legacy sessions to expire and never resurrects them on rollback', async () => {
    const migration = new CanonicalRefreshSessions1793400000000();
    const runner = dataSource.createQueryRunner();
    await runner.connect();
    try {
      await migration.down(runner);
      const user = await createUser();
      const sessionId = randomUUID();
      await runner.query(
        `INSERT INTO auth_sessions
          (session_id, user_id, refresh_token_hash, expires_at, revoked_at)
         VALUES ($1, $2, $3, now() + interval '7 days', NULL)`,
        [sessionId, user.id, sha256('legacy-refresh')],
      );
      await migration.up(runner);
      let rows: Array<{ revoked_at: Date | null }> = await runner.query(
        'SELECT revoked_at FROM auth_sessions WHERE session_id = $1',
        [sessionId],
      );
      expect(rows[0].revoked_at).toBeInstanceOf(Date);

      await migration.down(runner);
      rows = await runner.query(
        'SELECT revoked_at FROM auth_sessions WHERE session_id = $1',
        [sessionId],
      );
      expect(rows[0].revoked_at).toBeInstanceOf(Date);
      await migration.up(runner);
    } finally {
      await runner.release();
    }
  });

  async function createUser(): Promise<User> {
    return dataSource.getRepository(User).save({
      email: `${randomUUID()}@example.test`,
      password: `hash-${randomUUID()}`,
      first_name: 'Session',
      last_name: 'Tester',
      role: ['PATIENT'],
      is_active: true,
      is_verified: true,
      account_status: AccountStatus.ACTIVE,
      email_verified_at: new Date(),
    } as User);
  }

  function sha256(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }
});
