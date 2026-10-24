import { createHash, randomUUID } from 'node:crypto';
import { env } from 'node:process';

import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { DataSource } from 'typeorm';

import { AccountAccessPolicyService } from '../../modules/auth/account-access-policy.service';
import { AuthSession } from '../../modules/auth/entities/auth.entity';
import { RefreshCredential } from '../../modules/auth/entities/refresh-credential.entity';
import { RefreshSessionService } from '../../modules/auth/refresh-session.service';
import { User } from '../../modules/user/entities/user.entity';
import { AccountStatus } from '../../modules/user/enums/account-status.enum';
import { UserRole } from '../../modules/user/enums/user-role.enum';
import { RefreshSessionFoundation1792850000000 } from '../migrations/1792850000000-RefreshSessionFoundation';

const integration = env.PG_INTEGRATION_URL ? describe : describe.skip;
const secret = 'local-integration-secret-not-used-outside-tests';

integration('Refresh session foundation on real PostgreSQL', () => {
  let database: DataSource;
  let admin: DataSource;
  let service: RefreshSessionService;
  let user: User;
  const databaseName = 'sessions_' + randomUUID().replaceAll('-', '');
  const settings = {
    ['JWT_SECRET']: secret,
    ['TOKEN_ACCESS_DURATION']: '15m',
    ['TOKEN_REFRESH_DURATION']: '7d',
  };

  beforeAll(async () => {
    admin = await new DataSource({
      type: 'postgres',
      url: env.PG_INTEGRATION_URL,
    }).initialize();
    await admin.query(`CREATE DATABASE "${databaseName}"`);
    const databaseUrl = new URL(env.PG_INTEGRATION_URL!);
    databaseUrl.pathname = databaseName;
    database = await new DataSource({
      type: 'postgres',
      url: databaseUrl.toString(),
      entities: [__dirname + '/../../modules/**/*.entity.ts'],
      migrations: [__dirname + '/../migrations/*.ts'],
      synchronize: false,
    }).initialize();
    await database.runMigrations();
    service = new RefreshSessionService(
      database,
      new JwtService(),
      new ConfigService(settings),
      new AccountAccessPolicyService(),
    );
  }, 30000);

  beforeEach(async () => {
    user = await database.getRepository(User).save({
      email: randomUUID() + '@example.test',
      password: 'unused-test-hash',
      first_name: 'Test',
      last_name: 'User',
      role: [UserRole.PATIENT],
      account_status: AccountStatus.ACTIVE,
      email_verified_at: new Date(),
      is_active: true,
      is_verified: true,
    });
  });

  afterAll(async () => {
    if (database?.isInitialized) await database.destroy();
    if (admin?.isInitialized) {
      await admin.query(`DROP DATABASE IF EXISTS "${databaseName}"`);
      await admin.destroy();
    }
  });

  it('stores only hashes, issues short session-bound access tokens, and projects safe session metadata', async () => {
    const issued = await service.issue(user.id);
    expect(issued.refresh_token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const claims = new JwtService().verify(issued.access_token, {
      secret,
      algorithms: ['HS256'],
    });
    expect(claims).toMatchObject({ sub: user.id, sid: issued.session_id });
    expect(claims.exp - claims.iat).toBe(900);
    expect(claims).not.toHaveProperty('role');
    expect(claims).not.toHaveProperty('email');
    const family = await database
      .getRepository(AuthSession)
      .findOneByOrFail({ session_id: issued.session_id });
    const credentials = await database
      .getRepository(RefreshCredential)
      .findBy({ session_id: issued.session_id });
    expect(family.refresh_token_hash).toBe(
      createHash('sha256').update(issued.refresh_token).digest('hex'),
    );
    expect(JSON.stringify([family, credentials])).not.toContain(
      issued.refresh_token,
    );
    const listed = await service.list(user.id);
    expect(listed).toHaveLength(1);
    expect(Object.keys(listed[0]).sort()).toEqual([
      'created_at',
      'expires_at',
      'last_used_at',
      'session_id',
    ]);
  });

  it('rotates within one family with absolute expiry and commits replay revocation before rejecting', async () => {
    const first = await service.issue(user.id);
    const second = await service.rotate(first.refresh_token);
    expect(second.session_id).toBe(first.session_id);
    expect(second.refresh_token).not.toBe(first.refresh_token);
    expect(second.session_expires_at).toEqual(first.session_expires_at);
    expect((await service.validate(user.id, first.session_id)).id).toBe(
      user.id,
    );
    await expect(service.rotate(first.refresh_token)).rejects.toThrow(
      UnauthorizedException,
    );
    await expect(service.rotate(second.refresh_token)).rejects.toThrow(
      UnauthorizedException,
    );
    await expect(service.validate(user.id, second.session_id)).rejects.toThrow(
      UnauthorizedException,
    );
    const family = await database
      .getRepository(AuthSession)
      .findOneByOrFail({ session_id: first.session_id });
    expect(family.revoked_at).toBeInstanceOf(Date);
    expect(
      await database
        .getRepository(RefreshCredential)
        .countBy({ session_id: first.session_id }),
    ).toBe(2);
  });

  it('serializes simultaneous refreshes and revokes the winning replacement after replay', async () => {
    const initial = await service.issue(user.id);
    const results = await Promise.allSettled([
      service.rotate(initial.refresh_token),
      service.rotate(initial.refresh_token),
    ]);
    expect(
      results.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(1);
    expect(
      results.filter((result) => result.status === 'rejected'),
    ).toHaveLength(1);
    const winner = results.find((result) => result.status === 'fulfilled');
    if (winner?.status !== 'fulfilled')
      throw new Error('Expected one rotation winner');
    await expect(service.rotate(winner.value.refresh_token)).rejects.toThrow(
      UnauthorizedException,
    );
    await expect(service.validate(user.id, initial.session_id)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('cannot revoke or validate another user’s session', async () => {
    const initial = await service.issue(user.id);
    const other = await database.getRepository(User).save({
      ...user,
      id: randomUUID(),
      email: randomUUID() + '@example.test',
    });
    await service.revoke(other.id, initial.session_id);
    await expect(
      service.validate(other.id, initial.session_id),
    ).rejects.toThrow(UnauthorizedException);
    expect((await service.rotate(initial.refresh_token)).session_id).toBe(
      initial.session_id,
    );
    expect(await service.list(other.id)).toEqual([]);
  });

  it('serializes logout against refresh so no usable replacement survives', async () => {
    const initial = await service.issue(user.id);
    await Promise.allSettled([
      service.rotate(initial.refresh_token),
      service.revoke(user.id, initial.session_id),
    ]);
    await expect(service.validate(user.id, initial.session_id)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('supports atomic credential mutation and revoke-all, and rolls both back on failure', async () => {
    const initial = await service.issue(user.id);
    await expect(
      database.transaction(async (manager) => {
        await service.revokeAllInTransaction(manager, user.id);
        await manager.update(User, user.id, {
          password: 'rolled-back-password-hash',
        });
        throw new Error('simulated credential failure');
      }),
    ).rejects.toThrow('simulated credential failure');
    expect((await service.validate(user.id, initial.session_id)).password).toBe(
      'unused-test-hash',
    );
    await database.transaction(async (manager) => {
      await service.revokeAllInTransaction(manager, user.id);
      await manager.update(User, user.id, {
        password: 'replacement-password-hash',
      });
    });
    await expect(service.validate(user.id, initial.session_id)).rejects.toThrow(
      UnauthorizedException,
    );
    expect(
      (await database.getRepository(User).findOneByOrFail({ id: user.id }))
        .password,
    ).toBe('replacement-password-hash');
  });

  it('serializes revoke-all with refresh and preserves other accounts’ sessions', async () => {
    const initial = await service.issue(user.id);
    const another = await service.issue(user.id);
    const other = await database.getRepository(User).save({
      ...user,
      id: randomUUID(),
      email: randomUUID() + '@example.test',
    });
    const unaffected = await service.issue(other.id);
    await Promise.allSettled([
      service.rotate(initial.refresh_token),
      database.transaction((manager) =>
        service.revokeAllInTransaction(manager, user.id),
      ),
    ]);
    await expect(service.validate(user.id, initial.session_id)).rejects.toThrow(
      UnauthorizedException,
    );
    await expect(service.validate(user.id, another.session_id)).rejects.toThrow(
      UnauthorizedException,
    );
    expect(await service.list(user.id)).toEqual([]);
    expect((await service.validate(other.id, unaffected.session_id)).id).toBe(
      other.id,
    );
  });

  it('fails closed on canonical account restrictions, expired sessions, malformed and unknown tokens', async () => {
    const initial = await service.issue(user.id);
    await database
      .getRepository(AuthSession)
      .update({ session_id: initial.session_id }, { expires_at: new Date(0) });
    await expect(service.rotate(initial.refresh_token)).rejects.toThrow(
      UnauthorizedException,
    );
    await expect(service.validate(user.id, initial.session_id)).rejects.toThrow(
      UnauthorizedException,
    );
    await expect(service.rotate('bad')).rejects.toThrow(UnauthorizedException);
    await expect(service.rotate('a'.repeat(43))).rejects.toThrow(
      UnauthorizedException,
    );
    await database.query(
      'UPDATE users SET account_status = $1, is_active = false WHERE id = $2',
      [AccountStatus.SUSPENDED, user.id],
    );
    await expect(service.issue(user.id)).rejects.toThrow(UnauthorizedException);
    await expect(service.validate(user.id, initial.session_id)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rolls rotation back if signing fails, leaving the original refresh credential usable', async () => {
    const initial = await service.issue(user.id);
    const signer = new JwtService();
    jest
      .spyOn(signer, 'signAsync')
      .mockRejectedValue(new Error('signing failure'));
    const failingService = new RefreshSessionService(
      database,
      signer,
      new ConfigService(settings),
      new AccountAccessPolicyService(),
    );
    await expect(failingService.rotate(initial.refresh_token)).rejects.toThrow(
      'signing failure',
    );
    expect(
      await database
        .getRepository(RefreshCredential)
        .countBy({ session_id: initial.session_id }),
    ).toBe(1);
    expect((await service.rotate(initial.refresh_token)).session_id).toBe(
      initial.session_id,
    );
  });

  it('preserves legacy rows on upgrade and revokes version-2 families on rollback', async () => {
    const initial = await service.issue(user.id);
    const legacyId = randomUUID();
    await database.getRepository(AuthSession).save({
      session_id: legacyId,
      user_id: user.id,
      credential_version: 1,
      refresh_token_hash: 'legacy-hash',
      expires_at: new Date(Date.now() + 60000),
      revoked_at: null,
    });
    const runner = database.createQueryRunner();
    await runner.connect();
    await runner.startTransaction();
    try {
      await new RefreshSessionFoundation1792850000000().down(runner);
      const [row] = await runner.query(
        'SELECT revoked_at FROM auth_sessions WHERE session_id = $1',
        [initial.session_id],
      );
      expect(row.revoked_at).toBeInstanceOf(Date);
      await new RefreshSessionFoundation1792850000000().up(runner);
      const [upgraded] = await runner.query(
        'SELECT credential_version, revoked_at FROM auth_sessions WHERE session_id = $1',
        [initial.session_id],
      );
      expect(upgraded.credential_version).toBe(1);
      expect(upgraded.revoked_at).toBeInstanceOf(Date);
      const [legacy] = await runner.query(
        'SELECT credential_version, revoked_at FROM auth_sessions WHERE session_id = $1',
        [legacyId],
      );
      expect(legacy).toEqual({ credential_version: 1, revoked_at: null });
    } finally {
      await runner.rollbackTransaction();
      await runner.release();
    }
  });
});
