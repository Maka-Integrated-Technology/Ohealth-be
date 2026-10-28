import { randomUUID } from 'node:crypto';
import { env } from 'node:process';

import { DataSource, QueryRunner } from 'typeorm';

import { AccountAccessPolicyService } from '../../modules/auth/account-access-policy.service';
import { User } from '../../modules/user/entities/user.entity';
import { AccountStatus } from '../../modules/user/enums/account-status.enum';
import { UserService } from '../../modules/user/user.service';
import { CanonicalAccountLifecycle1792750000000 } from '../migrations/1792750000000-CanonicalAccountLifecycle';

const integration = env.PG_INTEGRATION_URL ? describe : describe.skip;

integration('Canonical account lifecycle on real PostgreSQL', () => {
  let dataSource: DataSource;
  let runner: QueryRunner;
  let schemaName: string;

  beforeAll(async () => {
    dataSource = new DataSource({
      type: 'postgres',
      url: env.PG_INTEGRATION_URL,
      entities: [__dirname + '/../../modules/**/*.entity.ts'],
      synchronize: false,
    });
    await dataSource.initialize();
    await dataSource.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
  });

  beforeEach(async () => {
    schemaName = 'lifecycle_' + randomUUID().replaceAll('-', '');
    await dataSource.query(`CREATE SCHEMA "${schemaName}"`);
    runner = dataSource.createQueryRunner();
    await runner.connect();
    await runner.query(`SET search_path TO "${schemaName}", public`);
    await runner.startTransaction();
    await runner.query(`
      CREATE TABLE users (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        email varchar NOT NULL DEFAULT (uuid_generate_v4()::text || '@example.test'),
        password varchar NOT NULL DEFAULT 'password-hash',
        first_name varchar NOT NULL DEFAULT 'Test',
        last_name varchar NOT NULL DEFAULT 'User',
        middle_name varchar,
        gender varchar,
        dob date,
        phone varchar,
        country varchar,
        image varchar,
        role varchar NOT NULL DEFAULT 'PATIENT',
        account_status varchar NOT NULL DEFAULT 'pending_verification',
        is_active boolean NOT NULL DEFAULT true,
        is_verified boolean NOT NULL DEFAULT false,
        email_verified_at timestamptz,
        verification_code varchar,
        verification_code_expires_at timestamptz,
        google_id varchar,
        reset_token varchar,
        reset_token_expiry timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);
  });

  afterEach(async () => {
    if (runner?.isTransactionActive) await runner.rollbackTransaction();
    await runner?.release();
    if (schemaName) {
      await dataSource.query(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
    }
  });

  afterAll(async () => {
    if (dataSource?.isInitialized) await dataSource.destroy();
  });

  it('backfills legacy rows, preserves restrictions, records audit history and enforces constraints', async () => {
    const ids = Array.from({ length: 5 }, () => randomUUID());
    await runner.query(
      `INSERT INTO users (id, account_status, is_active, is_verified, email_verified_at) VALUES
        ($1, 'pending_verification', true, true, '2026-01-01T00:00:00Z'),
        ($2, 'active', true, false, NULL),
        ($3, 'suspended', true, true, NULL),
        ($4, 'deactivated', true, false, NULL),
        ($5, 'pending_verification', false, false, NULL)`,
      ids,
    );
    await new CanonicalAccountLifecycle1792750000000().up(runner);
    const rows: Array<{
      id: string;
      account_status: string;
      is_active: boolean;
      is_verified: boolean;
      email_verified_at: Date | null;
    }> = await runner.query('SELECT * FROM users ORDER BY id');
    const byId = new Map(rows.map((row) => [row.id, row]));
    expect(byId.get(ids[0])).toMatchObject({
      account_status: 'active',
      is_active: true,
      is_verified: true,
    });
    expect(byId.get(ids[0])?.email_verified_at).toBeTruthy();
    expect(byId.get(ids[1])).toMatchObject({
      account_status: 'pending_verification',
      is_active: false,
      is_verified: false,
    });
    expect(byId.get(ids[1])?.email_verified_at).toBeNull();
    expect(byId.get(ids[2])).toMatchObject({
      account_status: 'suspended',
      is_active: false,
      is_verified: false,
    });
    expect(byId.get(ids[3])).toMatchObject({
      account_status: 'deactivated',
      is_active: false,
      is_verified: false,
    });
    expect(byId.get(ids[4])).toMatchObject({
      account_status: 'pending_verification',
      is_active: false,
      is_verified: false,
    });

    const defaults: Array<{ column_default: string }> = await runner.query(
      `SELECT column_default FROM information_schema.columns
       WHERE table_schema = current_schema() AND table_name = 'users' AND column_name = 'is_active'`,
    );
    expect(defaults[0].column_default).toBe('false');

    const history: Array<{
      user_id: string;
      previous_status: string;
      new_status: string;
    }> = await runner.query(
      'SELECT user_id, previous_status, new_status FROM user_account_status_history',
    );
    expect(history).toEqual(
      expect.arrayContaining([
        {
          user_id: ids[0],
          previous_status: 'pending_verification',
          new_status: 'active',
        },
        {
          user_id: ids[1],
          previous_status: 'active',
          new_status: 'pending_verification',
        },
      ]),
    );

    await expect(
      runner.query(`UPDATE users SET is_active = true WHERE id = $1`, [ids[2]]),
    ).rejects.toThrow();
  });

  it('fails the migration transaction closed on an unsupported account state', async () => {
    await runner.query(
      'INSERT INTO users (account_status, is_active, is_verified) VALUES ($1, false, false)',
      ['unknown'],
    );
    await expect(
      new CanonicalAccountLifecycle1792750000000().up(runner),
    ).rejects.toThrow('Unsupported account_status');
  });

  it('allows the production verification service to consume a code exactly once', async () => {
    const id = randomUUID();
    await runner.query(
      `INSERT INTO users (id, email, account_status, is_active, is_verified,
        verification_code, verification_code_expires_at)
       VALUES ($1, 'pending@example.test', 'pending_verification', false, false,
         '123456', now() + interval '10 minutes')`,
      [id],
    );
    await new CanonicalAccountLifecycle1792750000000().up(runner);
    await runner.commitTransaction();

    const firstRunner = await createServiceRunner();
    const secondRunner = await createServiceRunner();
    try {
      const outcomes = await Promise.allSettled(
        [firstRunner.service, secondRunner.service].map((service) =>
          service.verifyEmailWithCode('pending@example.test', '123456'),
        ),
      );
      expect(
        outcomes.filter(({ status }) => status === 'fulfilled'),
      ).toHaveLength(1);
      expect(
        outcomes.filter(({ status }) => status === 'rejected'),
      ).toHaveLength(1);

      const [user] = await runner.query(
        `SELECT account_status, email_verified_at, verification_code
         FROM users WHERE id = $1`,
        [id],
      );
      expect(user).toMatchObject({
        account_status: AccountStatus.ACTIVE,
        verification_code: null,
      });
      expect(user.email_verified_at).toBeTruthy();
      const [{ count }] = await runner.query(
        `SELECT count(*)::int AS count FROM user_account_status_history
         WHERE user_id = $1 AND reason = 'verified_email_code'`,
        [id],
      );
      expect(count).toBe(1);
    } finally {
      await firstRunner.runner.release();
      await secondRunner.runner.release();
    }
  });

  it('never lets verification reactivate an account racing an administrative suspension', async () => {
    const userId = randomUUID();
    const adminId = randomUUID();
    await runner.query(
      `INSERT INTO users
        (id, email, role, account_status, is_active, is_verified,
         email_verified_at, verification_code, verification_code_expires_at)
       VALUES
        ($1, 'race@example.test', 'PATIENT', 'pending_verification', false,
         false, NULL, '123456', now() + interval '10 minutes'),
        ($2, 'admin@example.test', 'ADMIN', 'active', true, true, now(), NULL, NULL)`,
      [userId, adminId],
    );
    await new CanonicalAccountLifecycle1792750000000().up(runner);
    await runner.commitTransaction();

    const verifier = await createServiceRunner();
    const administrator = await createServiceRunner();
    try {
      await Promise.allSettled([
        verifier.service.verifyEmailWithCode('race@example.test', '123456'),
        administrator.service.transitionAccountStatus(
          userId,
          AccountStatus.SUSPENDED,
          adminId,
          'concurrent security review',
        ),
      ]);

      const [user] = await runner.query(
        'SELECT account_status, is_active FROM users WHERE id = $1',
        [userId],
      );
      expect(user).toEqual({
        account_status: AccountStatus.SUSPENDED,
        is_active: false,
      });
      const history: Array<{ new_status: AccountStatus; reason: string }> =
        await runner.query(
          `SELECT new_status, reason FROM user_account_status_history
           WHERE user_id = $1 ORDER BY changed_at`,
          [userId],
        );
      expect(history).toEqual(
        expect.arrayContaining([
          {
            new_status: AccountStatus.SUSPENDED,
            reason: 'concurrent security review',
          },
        ]),
      );
    } finally {
      await verifier.runner.release();
      await administrator.runner.release();
    }
  });

  it('commits password reset and session revocation together; replay fails', async () => {
    const userId = randomUUID();
    const sessionId = randomUUID();
    await runner.query(
      `INSERT INTO users (id, email, account_status, is_active, is_verified,
        email_verified_at, reset_token, reset_token_expiry)
       VALUES ($1, 'reset@example.test', 'active', true, true,
         now(), 'one-time-code', now() + interval '10 minutes')`,
      [userId],
    );
    await runner.query(
      `CREATE TABLE auth_sessions (
        id uuid PRIMARY KEY,
        user_id uuid NOT NULL,
        revoked_at timestamptz,
        updated_at timestamptz NOT NULL DEFAULT now()
      )`,
    );
    await runner.query(
      'INSERT INTO auth_sessions (id, user_id) VALUES ($1, $2)',
      [sessionId, userId],
    );
    await new CanonicalAccountLifecycle1792750000000().up(runner);
    await runner.commitTransaction();

    const client = await createServiceRunner();
    try {
      await client.service.consumePasswordResetToken(
        'one-time-code',
        'new-password-hash',
      );
      const users: Array<{ password: string; reset_token: string | null }> =
        await runner.query(
          'SELECT password, reset_token FROM users WHERE id = $1',
          [userId],
        );
      const sessions: Array<{ revoked_at: Date | null }> = await runner.query(
        'SELECT revoked_at FROM auth_sessions WHERE id = $1',
        [sessionId],
      );
      expect(users[0]).toEqual({
        password: 'new-password-hash',
        reset_token: null,
      });
      expect(sessions[0].revoked_at).toBeInstanceOf(Date);
      await expect(
        client.service.consumePasswordResetToken(
          'one-time-code',
          'replayed-hash',
        ),
      ).rejects.toThrow();
      const [{ password }] = await runner.query(
        'SELECT password FROM users WHERE id = $1',
        [userId],
      );
      expect(password).toBe('new-password-hash');
    } finally {
      await client.runner.release();
    }
  });

  it('rolls back password replacement when session revocation fails', async () => {
    const userId = randomUUID();
    await runner.query(
      `INSERT INTO users (id, email, account_status, is_active, is_verified,
        email_verified_at, reset_token, reset_token_expiry)
       VALUES ($1, 'rollback@example.test', 'active', true, true,
         now(), 'rollback-code', now() + interval '10 minutes')`,
      [userId],
    );
    await new CanonicalAccountLifecycle1792750000000().up(runner);
    await runner.commitTransaction();

    const client = await createServiceRunner();
    try {
      // Missing auth_sessions simulates a failed security revocation write.
      await expect(
        client.service.consumePasswordResetToken(
          'rollback-code',
          'unsafe-new-password',
        ),
      ).rejects.toThrow();
      const users: Array<{ password: string; reset_token: string }> =
        await runner.query(
          'SELECT password, reset_token FROM users WHERE id = $1',
          [userId],
        );
      expect(users[0]).toEqual({
        password: 'password-hash',
        reset_token: 'rollback-code',
      });
    } finally {
      await client.runner.release();
    }
  });

  async function createServiceRunner(): Promise<{
    runner: QueryRunner;
    service: UserService;
  }> {
    const serviceRunner = dataSource.createQueryRunner();
    await serviceRunner.connect();
    await serviceRunner.query(`SET search_path TO "${schemaName}", public`);
    return {
      runner: serviceRunner,
      service: new UserService(
        serviceRunner.manager.getRepository(User),
        new AccountAccessPolicyService(),
      ),
    };
  }
});
