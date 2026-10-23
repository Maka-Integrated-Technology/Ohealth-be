import { randomUUID } from 'node:crypto';
import { env } from 'node:process';

import { DataSource, QueryRunner } from 'typeorm';

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
        account_status varchar NOT NULL DEFAULT 'pending_verification',
        is_active boolean NOT NULL DEFAULT true,
        is_verified boolean NOT NULL DEFAULT false,
        email_verified_at timestamptz,
        verification_code varchar,
        verification_code_expires_at timestamptz,
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

  it('prevents a second verification update from consuming the same code after first use', async () => {
    const id = randomUUID();
    await runner.query(
      `INSERT INTO users (id, account_status, is_active, is_verified,
        verification_code, verification_code_expires_at)
       VALUES ($1, 'pending_verification', false, false, '123456', now() + interval '10 minutes')`,
      [id],
    );
    await new CanonicalAccountLifecycle1792750000000().up(runner);
    // Commit the fixture, then race two independent PostgreSQL connections.
    await runner.commitTransaction();
    await runner.startTransaction();
    await runner.query('SELECT id FROM users WHERE id = $1 FOR UPDATE', [id]);

    const contender = dataSource.createQueryRunner();
    await contender.connect();
    try {
      await contender.query(`SET search_path TO "${schemaName}", public`);
      await contender.startTransaction();
      const competingUpdate = contender.query(
        `UPDATE users SET account_status = 'active', is_active = true,
          is_verified = true, email_verified_at = now(),
          verification_code = NULL, verification_code_expires_at = NULL
         WHERE id = $1 AND account_status = 'pending_verification'
           AND verification_code = '123456'
         RETURNING id`,
        [id],
      );

      const first = await runner.query(
        `UPDATE users SET account_status = 'active', is_active = true,
          is_verified = true, email_verified_at = now(),
          verification_code = NULL, verification_code_expires_at = NULL
         WHERE id = $1 AND account_status = 'pending_verification'
           AND verification_code = '123456'
         RETURNING id`,
        [id],
      );
      await runner.commitTransaction();
      const second = await competingUpdate;
      await contender.commitTransaction();

      // TypeORM's PostgreSQL QueryRunner returns [rows, affectedRowCount].
      expect(first[1]).toBe(1);
      expect(second[1]).toBe(0);
    } finally {
      if (contender.isTransactionActive) await contender.rollbackTransaction();
      await contender.release();
    }
  });
});
