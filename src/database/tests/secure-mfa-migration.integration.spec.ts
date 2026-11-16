import { randomUUID } from 'node:crypto';
import { env } from 'node:process';

import { DataSource, QueryRunner } from 'typeorm';

import { SecureMfa1794000000000 } from '../migrations/1794000000000-SecureMfa';

const integration = env.PG_INTEGRATION_URL ? describe : describe.skip;

integration('Secure MFA migration on PostgreSQL', () => {
  let dataSource: DataSource;
  let runner: QueryRunner;
  let schema: string;

  beforeAll(async () => {
    dataSource = new DataSource({
      type: 'postgres',
      url: env.PG_INTEGRATION_URL,
    });
    await dataSource.initialize();
    await dataSource.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
  });

  beforeEach(async () => {
    schema = 'secure_mfa_' + randomUUID().replaceAll('-', '');
    await dataSource.query(`CREATE SCHEMA "${schema}"`);
    runner = dataSource.createQueryRunner();
    await runner.connect();
    await runner.query(`SET search_path TO "${schema}", public`);
    await runner.query('CREATE TABLE users (id uuid PRIMARY KEY)');
    await runner.query(`CREATE TABLE user_2fa (
      id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      user_id uuid NOT NULL UNIQUE,
      two_fa_secret varchar NOT NULL,
      two_fa_enabled boolean NOT NULL DEFAULT false,
      backup_codes text[],
      CONSTRAINT "FK_ed539980faac14226a05368c4d1"
        FOREIGN KEY (user_id) REFERENCES users(id)
    )`);
    await runner.query(`CREATE TABLE auth_challenges (
      id uuid PRIMARY KEY,
      purpose varchar NOT NULL,
      CONSTRAINT "CHK_auth_challenge_purpose"
        CHECK (purpose IN ('contact_verification', 'password_recovery', 'login_verification'))
    )`);
  });

  afterEach(async () => {
    await runner?.release();
    await dataSource.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
  });

  afterAll(async () => dataSource.destroy());

  it('invalidates plaintext factors and installs the secure schema', async () => {
    const userId = randomUUID();
    await runner.query('INSERT INTO users (id) VALUES ($1)', [userId]);
    await runner.query(
      `INSERT INTO user_2fa (user_id, two_fa_secret, two_fa_enabled, backup_codes)
       VALUES ($1, 'PLAINTEXT', true, ARRAY['RECOVERY'])`,
      [userId],
    );

    await new SecureMfa1794000000000().up(runner);

    const factor = await runner.query(
      'SELECT two_fa_enabled, encrypted_secret, pending_secret FROM user_2fa WHERE user_id = $1',
      [userId],
    );
    expect(factor).toEqual([
      { two_fa_enabled: false, encrypted_secret: null, pending_secret: null },
    ]);
    const columns = await runner.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema = $1 AND table_name = 'user_2fa'`,
      [schema],
    );
    expect(
      columns.map((row: { column_name: string }) => row.column_name),
    ).not.toEqual(expect.arrayContaining(['two_fa_secret', 'backup_codes']));
    await expect(
      runner.query(
        `INSERT INTO auth_challenges (id, purpose) VALUES ($1, 'mfa_login')`,
        [randomUUID()],
      ),
    ).resolves.toBeDefined();
  });

  it('hash rows are unique and deleted with their user', async () => {
    const userId = randomUUID();
    await runner.query('INSERT INTO users (id) VALUES ($1)', [userId]);
    await new SecureMfa1794000000000().up(runner);
    const hash = 'a'.repeat(64);
    await runner.query(
      'INSERT INTO mfa_recovery_codes (user_id, code_hash) VALUES ($1, $2)',
      [userId, hash],
    );
    await expect(
      runner.query(
        'INSERT INTO mfa_recovery_codes (user_id, code_hash) VALUES ($1, $2)',
        [userId, hash],
      ),
    ).rejects.toMatchObject({ code: '23505' });
    await runner.query('DELETE FROM users WHERE id = $1', [userId]);
    await expect(
      runner.query('SELECT * FROM mfa_recovery_codes'),
    ).resolves.toEqual([]);
  });
});
