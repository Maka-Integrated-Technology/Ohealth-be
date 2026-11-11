import { randomUUID } from 'node:crypto';
import { env } from 'node:process';

import { DataSource, QueryRunner } from 'typeorm';

import { AuthChallengeFoundation1793000000000 } from '../migrations/1793000000000-AuthChallengeFoundation';
import { AuthChallengeContinuation1793700000000 } from '../migrations/1793700000000-AuthChallengeContinuation';

const integration = env.PG_INTEGRATION_URL ? describe : describe.skip;

integration('Auth challenge continuation migration on PostgreSQL', () => {
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
    schemaName = 'challenge_continuation_' + randomUUID().replaceAll('-', '');
    await dataSource.query(`CREATE SCHEMA "${schemaName}"`);
    runner = dataSource.createQueryRunner();
    await runner.connect();
    await runner.query(`SET search_path TO "${schemaName}", public`);
    await runner.startTransaction();
    await runner.query('CREATE TABLE users (id uuid PRIMARY KEY)');
    await new AuthChallengeFoundation1793000000000().up(runner);
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

  it('backfills active and consumed legacy history without changing usability', async () => {
    const userId = randomUUID();
    const activeId = randomUUID();
    const consumedId = randomUUID();
    await runner.query('INSERT INTO users (id) VALUES ($1)', [userId]);
    await runner.query(
      `INSERT INTO auth_challenges
         (id, purpose, subject_user_id, secret_hash, expires_at, consumed_at)
       VALUES
         ($1, 'contact_verification', $3, $4, now() + interval '10 minutes', NULL),
         ($2, 'password_recovery', $3, $4, now() + interval '10 minutes', now())`,
      [activeId, consumedId, userId, 'a'.repeat(64)],
    );

    await new AuthChallengeContinuation1793700000000().up(runner);

    const rows: Array<{
      id: string;
      lineage_id: string;
      terminal_reason: string | null;
      replacement_count: number;
      flow_expires_at: Date;
      expires_at: Date;
    }> = await runner.query(
      `SELECT id, lineage_id, terminal_reason, replacement_count,
              flow_expires_at, expires_at
       FROM auth_challenges ORDER BY id`,
    );
    expect(rows).toHaveLength(2);
    for (const row of rows) {
      expect(row.lineage_id).toBe(row.id);
      expect(row.replacement_count).toBe(0);
      expect(row.flow_expires_at.getTime()).toBeGreaterThanOrEqual(
        row.expires_at.getTime(),
      );
    }
    expect(rows.find((row) => row.id === activeId)?.terminal_reason).toBeNull();
    expect(rows.find((row) => row.id === consumedId)?.terminal_reason).toBe(
      'legacy_consumed',
    );
  });
});
