/* eslint-disable @typescript-eslint/naming-convention */
import { randomUUID } from 'node:crypto';
import { env } from 'node:process';

import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as speakeasy from 'speakeasy';
import { DataSource } from 'typeorm';

import { AccountAccessPolicyService } from '../../modules/auth/account-access-policy.service';
import { AuthChallengePurpose } from '../../modules/auth/challenges/auth-challenge.entity';
import { AuthChallengeService } from '../../modules/auth/challenges/auth-challenge.service';
import { AuthSession } from '../../modules/auth/entities/auth.entity';
import { MfaRecoveryCode } from '../../modules/auth/entities/mfa-recovery-code.entity';
import { User2fa } from '../../modules/auth/entities/user-2fa.entity';
import { MfaSecretBox } from '../../modules/auth/mfa-secret-box';
import { PasswordCredentialsService } from '../../modules/auth/password-policy/password-credentials.service';
import { AuthSecurityAuditService } from '../../modules/auth/security-audit/auth-security-audit.service';
import { RefreshSessionService } from '../../modules/auth/sessions/refresh-session.service';
import { TwoFactorAuthService } from '../../modules/auth/two-factor-auth.service';
import { User } from '../../modules/user/entities/user.entity';
import { AccountStatus } from '../../modules/user/enums/account-status.enum';
import { UserRole } from '../../modules/user/enums/user-role.enum';

const integration = env.PG_INTEGRATION_URL ? describe : describe.skip;

integration('Secure MFA lifecycle on real PostgreSQL', () => {
  let admin: DataSource;
  let dataSource: DataSource;
  let databaseName: string;
  let service: TwoFactorAuthService;
  let passwords: PasswordCredentialsService;
  let challenges: AuthChallengeService;
  let sessions: RefreshSessionService;
  const password = 'Correct-Horse-Battery-Staple-82!';
  const key = Buffer.alloc(32, 19).toString('base64');

  beforeAll(async () => {
    const baseUrl = new URL(env.PG_INTEGRATION_URL!);
    databaseName = 'mfa_lifecycle_' + randomUUID().replaceAll('-', '');
    admin = new DataSource({ type: 'postgres', url: baseUrl.toString() });
    await admin.initialize();
    await admin.query(`CREATE DATABASE "${databaseName}"`);
    baseUrl.pathname = '/' + databaseName;
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
    const config = new ConfigService({
      HASH_SALT: '10',
      MFA_ENCRYPTION_KEY: key,
      MFA_REQUIRED_CATEGORIES:
        'platform_admin,organization_owner,organization_admin',
      AUTH_CHALLENGE_PEPPER: 'mfa-lifecycle-pepper-at-least-thirty-two-bytes',
      JWT_SECRET: 'mfa-lifecycle-jwt-secret-at-least-thirty-two-bytes',
      TOKEN_ACCESS_DURATION: '15m',
      TOKEN_REFRESH_DURATION: '7d',
    });
    passwords = new PasswordCredentialsService(config);
    service = new TwoFactorAuthService(
      dataSource,
      new MfaSecretBox(config),
      passwords,
      new AuthSecurityAuditService(dataSource),
      config,
    );
    challenges = new AuthChallengeService(dataSource, config);
    sessions = new RefreshSessionService(
      dataSource,
      new JwtService(),
      config,
      new AccountAccessPolicyService(),
      new AuthSecurityAuditService(dataSource),
      passwords,
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

  it('confirms before activation and stores no recoverable plaintext', async () => {
    const user = await createUser();
    const enrollment = await service.enable2fa(user.id, password);
    let factor = await dataSource.getRepository(User2fa).findOneByOrFail({
      userId: user.id,
    });
    expect(factor.twoFaEnabled).toBe(false);
    expect(JSON.stringify(factor)).not.toContain(enrollment.secret);

    const code = speakeasy.totp({
      secret: enrollment.secret,
      encoding: 'base32',
    });
    const confirmed = await service.confirm2fa(user.id, code);
    expect(confirmed.recovery_codes).toHaveLength(8);

    factor = await dataSource.getRepository(User2fa).findOneByOrFail({
      userId: user.id,
    });
    expect(factor.twoFaEnabled).toBe(true);
    expect(factor.pendingSecret).toBeNull();
    const storedCodes = await dataSource
      .getRepository(MfaRecoveryCode)
      .findBy({ userId: user.id });
    expect(storedCodes).toHaveLength(8);
    expect(JSON.stringify(storedCodes)).not.toContain(
      confirmed.recovery_codes[0],
    );
    expect(
      JSON.stringify(
        await dataSource.query('SELECT * FROM user_2fa WHERE user_id = $1', [
          user.id,
        ]),
      ),
    ).not.toContain(enrollment.secret);
  });

  it('rejects TOTP replay and consumes a recovery code once', async () => {
    const user = await createUser();
    const enrollment = await service.enable2fa(user.id, password);
    const code = speakeasy.totp({
      secret: enrollment.secret,
      encoding: 'base32',
    });
    const confirmed = await service.confirm2fa(user.id, code);

    await expect(
      dataSource.transaction((manager) =>
        service.verifyForLogin(manager, user.id, code),
      ),
    ).resolves.toBe(false);
    await expect(
      dataSource.transaction((manager) =>
        service.verifyForLogin(manager, user.id, confirmed.recovery_codes[0]),
      ),
    ).resolves.toBe(true);
    await expect(
      dataSource.transaction((manager) =>
        service.verifyForLogin(manager, user.id, confirmed.recovery_codes[0]),
      ),
    ).resolves.toBe(false);
  });

  it('regenerates codes, disables a non-privileged factor, and revokes sessions', async () => {
    const user = await createUser();
    const base = Math.floor(Date.now() / 30_000) * 30_000;
    const now = jest.spyOn(Date, 'now').mockReturnValue(base);
    try {
      const enrollment = await service.enable2fa(user.id, password);
      const confirmationCode = speakeasy.totp({
        secret: enrollment.secret,
        encoding: 'base32',
        time: base / 1000,
      });
      const first = await service.confirm2fa(user.id, confirmationCode);
      const preRegenerationSession = await dataSource.transaction((manager) =>
        sessions.issueInTransaction(manager, user.id, undefined, true),
      );
      now.mockReturnValue(base + 30_000);
      const regenerateCode = speakeasy.totp({
        secret: enrollment.secret,
        encoding: 'base32',
        time: (base + 30_000) / 1000,
      });
      const second = await service.regenerateCodes(
        user.id,
        password,
        regenerateCode,
      );
      expect(second.recovery_codes).not.toEqual(first.recovery_codes);
      await expect(
        dataSource.getRepository(AuthSession).findOneByOrFail({
          session_id: preRegenerationSession.session_id,
        }),
      ).resolves.toMatchObject({ revoked_at: expect.any(Date) });
      await expect(
        dataSource.transaction((manager) =>
          service.verifyForLogin(manager, user.id, first.recovery_codes[1]),
        ),
      ).resolves.toBe(false);

      now.mockReturnValue(base + 60_000);
      const disableCode = speakeasy.totp({
        secret: enrollment.secret,
        encoding: 'base32',
        time: (base + 60_000) / 1000,
      });
      const preDisableSession = await dataSource.transaction((manager) =>
        sessions.issueInTransaction(manager, user.id, undefined, true),
      );
      await service.disable2fa(user.id, password, disableCode);
      await expect(
        dataSource.getRepository(AuthSession).findOneByOrFail({
          session_id: preDisableSession.session_id,
        }),
      ).resolves.toMatchObject({ revoked_at: expect.any(Date) });
      const factor = await dataSource.getRepository(User2fa).findOneByOrFail({
        userId: user.id,
      });
      expect(factor.twoFaEnabled).toBe(false);
      expect(factor.encryptedSecret).toBeNull();
      expect(
        await dataSource.getRepository(MfaRecoveryCode).countBy({
          userId: user.id,
        }),
      ).toBe(0);
    } finally {
      now.mockRestore();
    }
  });

  it('blocks direct session issuance and locks an MFA challenge after five failures', async () => {
    const user = await createUser();
    const enrollment = await service.enable2fa(user.id, password);
    const code = speakeasy.totp({
      secret: enrollment.secret,
      encoding: 'base32',
    });
    await service.confirm2fa(user.id, code);

    await expect(sessions.issue(user.id)).rejects.toThrow(
      'MFA verification required.',
    );
    const issued = await challenges.issueForUser(
      user.id,
      AuthChallengePurpose.MFA_LOGIN,
    );
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await expect(
        challenges.consumeWithExternalProof(
          issued.challengeId,
          AuthChallengePurpose.MFA_LOGIN,
          async () => null,
        ),
      ).rejects.toThrow();
    }
    const proof = jest.fn();
    await expect(
      challenges.consumeWithExternalProof(
        issued.challengeId,
        AuthChallengePurpose.MFA_LOGIN,
        proof,
      ),
    ).rejects.toThrow();
    expect(proof).not.toHaveBeenCalled();
    const rows = await dataSource.query(
      'SELECT attempt_count, terminal_reason FROM auth_challenges WHERE id = $1',
      [issued.challengeId],
    );
    expect(rows).toEqual([
      { attempt_count: 5, terminal_reason: 'attempts_exhausted' },
    ]);
  });

  it('prevents configured privileged accounts from disabling MFA', async () => {
    const user = await createUser();
    const base = Math.floor(Date.now() / 30_000) * 30_000;
    const now = jest.spyOn(Date, 'now').mockReturnValue(base);
    try {
      const enrollment = await service.enable2fa(user.id, password);
      await service.confirm2fa(
        user.id,
        speakeasy.totp({
          secret: enrollment.secret,
          encoding: 'base32',
          time: base / 1000,
        }),
      );
      await dataSource.query(
        `INSERT INTO platform_privileges (user_id, privilege)
         VALUES ($1, 'admin')`,
        [user.id],
      );
      now.mockReturnValue(base + 30_000);
      await expect(
        service.disable2fa(
          user.id,
          password,
          speakeasy.totp({
            secret: enrollment.secret,
            encoding: 'base32',
            time: (base + 30_000) / 1000,
          }),
        ),
      ).rejects.toThrow('MFA is required for this account.');
      await expect(
        dataSource.getRepository(User2fa).findOneByOrFail({ userId: user.id }),
      ).resolves.toMatchObject({ twoFaEnabled: true });
    } finally {
      now.mockRestore();
    }
  });

  async function createUser(): Promise<User> {
    return dataSource.getRepository(User).save({
      email: randomUUID() + '@example.test',
      password: await passwords.hashNewPassword(password),
      first_name: 'Mfa',
      last_name: 'Tester',
      role: [UserRole.PATIENT],
      is_active: true,
      is_verified: true,
      account_status: AccountStatus.ACTIVE,
      email_verified_at: new Date(),
      password_authentication_enabled: true,
    });
  }
});
