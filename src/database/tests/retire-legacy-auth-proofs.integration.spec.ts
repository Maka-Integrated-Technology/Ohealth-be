import { randomUUID } from 'node:crypto';
import { env } from 'node:process';

import { DataSource, QueryRunner } from 'typeorm';

import { RetireLegacyAuthProofs1795500000000 } from '../migrations/1795500000000-RetireLegacyAuthProofs';

const integration = env.PG_INTEGRATION_URL ? describe : describe.skip;

integration('Retired legacy auth proofs on real PostgreSQL', () => {
  let dataSource: DataSource;
  let runner: QueryRunner;
  let schemaName: string;

  beforeAll(async () => {
    dataSource = new DataSource({
      type: 'postgres',
      url: env.PG_INTEGRATION_URL,
    });
    await dataSource.initialize();
  });

  beforeEach(async () => {
    schemaName = 'retired_auth_' + randomUUID().replaceAll('-', '');
    await dataSource.query(`CREATE SCHEMA "${schemaName}"`);
    runner = dataSource.createQueryRunner();
    await runner.connect();
    await runner.query(`SET search_path TO "${schemaName}", public`);
    await runner.startTransaction();
    await runner.query(`CREATE TABLE users (
      id uuid PRIMARY KEY,
      password varchar NOT NULL,
      account_status varchar NOT NULL,
      role varchar NOT NULL DEFAULT 'PATIENT',
      verification_code varchar,
      verification_code_expires_at timestamptz,
      reset_token varchar,
      reset_token_expiry timestamptz
    )`);
  });

  afterEach(async () => {
    if (runner?.isTransactionActive) await runner.rollbackTransaction();
    await runner?.release();
    if (schemaName)
      await dataSource.query(`DROP SCHEMA "${schemaName}" CASCADE`);
  });

  afterAll(async () => {
    if (dataSource?.isInitialized) await dataSource.destroy();
  });

  it('clears legacy proofs, preserves account state, and rejects later proof writes', async () => {
    const id = randomUUID();
    await runner.query(
      `INSERT INTO users
      (id, password, account_status, role, verification_code, verification_code_expires_at,
       reset_token, reset_token_expiry)
      VALUES ($1, 'existing-password-hash', 'suspended', 'ADMIN', '123456', now(), 'old-reset-token', now())`,
      [id],
    );
    await new RetireLegacyAuthProofs1795500000000().up(runner);
    const [row] = await runner.query('SELECT * FROM users WHERE id = $1', [id]);
    expect(row).toMatchObject({
      password: 'existing-password-hash',
      account_status: 'suspended',
      role: 'ADMIN',
      verification_code: null,
      verification_code_expires_at: null,
      reset_token: null,
      reset_token_expiry: null,
    });
    await runner.query(
      `INSERT INTO users (id, password, account_status) VALUES ($1, 'hash', 'pending_verification')`,
      [randomUUID()],
    );
    const [{ role }] = await runner.query(
      `SELECT role FROM users WHERE account_status = 'pending_verification'`,
    );
    expect(role).toBeNull();
    await expect(
      runner.query('UPDATE users SET reset_token = $1 WHERE id = $2', [
        'new-token',
        id,
      ]),
    ).rejects.toThrow();
  });
});
