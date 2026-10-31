import { randomUUID } from 'node:crypto';
import { env } from 'node:process';

import { DataSource, QueryRunner } from 'typeorm';

import { AuthSecurityAuditFoundation1792900000000 } from '../migrations/1792900000000-AuthSecurityAuditFoundation';
import { AddOAuthUnlinkSecurityAudit1793180000000 } from '../migrations/1793180000000-AddOAuthUnlinkSecurityAudit';

const integration = env.PG_INTEGRATION_URL ? describe : describe.skip;

integration('OAuth unlink audit constraint (PostgreSQL)', () => {
  let database: DataSource;
  let runner: QueryRunner;
  let schema: string;

  beforeAll(async () => {
    database = new DataSource({
      type: 'postgres',
      url: env.PG_INTEGRATION_URL,
      synchronize: false,
    });
    await database.initialize();
    await database.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
  });

  beforeEach(async () => {
    schema = 'unlink_' + randomUUID().replaceAll('-', '');
    await database.query(`CREATE SCHEMA "${schema}"`);
    runner = database.createQueryRunner();
    await runner.connect();
    await runner.query(`SET search_path TO "${schema}", public`);
    await runner.startTransaction();
    await new AuthSecurityAuditFoundation1792900000000().up(runner);
  });

  afterEach(async () => {
    if (runner?.isTransactionActive) await runner.rollbackTransaction();
    await runner?.release();
    if (schema)
      await database.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
  });

  afterAll(async () => {
    if (database?.isInitialized) await database.destroy();
  });

  it('adds unlink while retaining existing audited link events and immutable history', async () => {
    await runner.query(
      "INSERT INTO auth_security_events (event_type, outcome) VALUES ('oauth_link', 'succeeded')",
    );
    await new AddOAuthUnlinkSecurityAudit1793180000000().up(runner);
    await runner.query(
      "INSERT INTO auth_security_events (event_type, outcome) VALUES ('oauth_unlink', 'succeeded')",
    );
    const records: Array<{ event_type: string }> = await runner.query(
      'SELECT event_type FROM auth_security_events ORDER BY occurred_at, id',
    );
    expect(records.map((item) => item.event_type).sort()).toEqual([
      'oauth_link',
      'oauth_unlink',
    ]);
    await expect(
      runner.query(
        "UPDATE auth_security_events SET outcome = 'failed' WHERE event_type = 'oauth_unlink'",
      ),
    ).rejects.toThrow('Authentication security audit events are immutable');
  });

  it('refuses unsupported security events after migration', async () => {
    await new AddOAuthUnlinkSecurityAudit1793180000000().up(runner);
    await expect(
      runner.query(
        "INSERT INTO auth_security_events (event_type, outcome) VALUES ('raw_identity_token', 'succeeded')",
      ),
    ).rejects.toMatchObject({ code: '23514' });
  });
});
