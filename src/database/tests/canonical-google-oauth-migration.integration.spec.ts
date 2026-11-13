import { randomUUID } from 'node:crypto';
import { env } from 'node:process';

import { ConfigService } from '@nestjs/config';
import { DataSource, QueryRunner } from 'typeorm';

import { OAuthTransaction } from '../../modules/auth/oauth/oauth-transaction.entity';
import { OAuthTransactionService } from '../../modules/auth/oauth/oauth-transaction.service';
import { CanonicalGoogleOAuth1793800000000 } from '../migrations/1793800000000-CanonicalGoogleOAuth';

const integration = env.PG_INTEGRATION_URL ? describe : describe.skip;

integration('Canonical Google OAuth migration on PostgreSQL', () => {
  let dataSource: DataSource;
  let runner: QueryRunner;
  let schemaName: string;

  beforeAll(async () => {
    dataSource = new DataSource({
      type: 'postgres',
      url: env.PG_INTEGRATION_URL,
      synchronize: false,
      entities: [OAuthTransaction],
    });
    await dataSource.initialize();
    await dataSource.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
  });

  beforeEach(async () => {
    schemaName = 'canonical_oauth_' + randomUUID().replaceAll('-', '');
    await dataSource.query(`CREATE SCHEMA "${schemaName}"`);
    runner = dataSource.createQueryRunner();
    await runner.connect();
    await runner.query(`SET search_path TO "${schemaName}", public`);
    await runner.startTransaction();
    await runner.query(
      'CREATE TABLE users (id uuid PRIMARY KEY, google_id varchar)',
    );
    await runner.query(
      `CREATE TABLE auth_security_events (
        id uuid PRIMARY KEY,
        event_type varchar NOT NULL,
        CONSTRAINT "CHK_auth_security_events_type" CHECK ("event_type" IN ('sign_in', 'contact_verification', 'password_recovery', 'password_change', 'session_refresh', 'session_reuse', 'logout', 'account_state_change', 'oauth_link', 'registration', 'mfa', 'login_challenge_request', 'login_challenge_resend', 'login_challenge_delivery', 'login_challenge_expiry', 'login_challenge_verification'))
      )`,
    );
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

  it('migrates legacy subjects and enforces transaction and identity invariants', async () => {
    const userId = randomUUID();
    await runner.query('INSERT INTO users (id, google_id) VALUES ($1, $2)', [
      userId,
      'legacy-google-subject',
    ]);
    await new CanonicalGoogleOAuth1793800000000().up(runner);

    await expect(
      runner.query(`SELECT issuer, subject, user_id FROM external_identities`),
    ).resolves.toEqual([
      {
        issuer: 'https://accounts.google.com',
        subject: 'legacy-google-subject',
        user_id: userId,
      },
    ]);
    await expect(
      runner.query(
        `INSERT INTO external_identities (user_id, provider, issuer, subject)
         VALUES ($1, 'google', 'https://accounts.google.com', 'legacy-google-subject')`,
        [randomUUID()],
      ),
    ).rejects.toMatchObject({ code: '23505' });
  });

  it('fails the migration when two legacy users claim the same subject', async () => {
    await runner.query(
      'INSERT INTO users (id, google_id) VALUES ($1, $3), ($2, $3)',
      [randomUUID(), randomUUID(), 'duplicate-subject'],
    );
    await expect(
      new CanonicalGoogleOAuth1793800000000().up(runner),
    ).rejects.toMatchObject({ code: '23505' });
  });

  it('allows exactly one of two concurrent completions to consume a transaction', async () => {
    await new CanonicalGoogleOAuth1793800000000().up(runner);
    const service = new OAuthTransactionService(
      dataSource.getRepository(OAuthTransaction),
      { get: jest.fn() } as unknown as ConfigService,
    );
    const id = randomUUID();
    const token = 't'.repeat(43);
    await runner.query(
      `INSERT INTO oauth_transactions
        (id, provider, operation, consumer, audience, transaction_token_hash, nonce_hash, expires_at)
       VALUES ($1, 'google', 'signin', 'web', 'client', $2, $3, now() + interval '5 minutes')`,
      [id, service.hash(token), 'n'.repeat(64)],
    );
    await runner.commitTransaction();

    const consume = async () => {
      const concurrent = dataSource.createQueryRunner();
      await concurrent.connect();
      await concurrent.query(`SET search_path TO "${schemaName}", public`);
      await concurrent.startTransaction();
      try {
        const result = await service.consumeInTransaction(
          concurrent.manager,
          id,
          token,
        );
        await concurrent.commitTransaction();
        return result;
      } catch (error) {
        await concurrent.rollbackTransaction();
        throw error;
      } finally {
        await concurrent.release();
      }
    };

    const outcomes = await Promise.allSettled([consume(), consume()]);
    expect(
      outcomes.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(1);
    const rejected = outcomes.find((result) => result.status === 'rejected');
    expect(rejected).toMatchObject({
      reason: { errorCode: 'OAUTH_TRANSACTION_REPLAYED' },
    });
  });

  it('stores only hashes and rejects unbound signup and link transactions', async () => {
    const userId = randomUUID();
    await runner.query('INSERT INTO users (id) VALUES ($1)', [userId]);
    await new CanonicalGoogleOAuth1793800000000().up(runner);

    const columns: Array<{ column_name: string }> = await runner.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema = current_schema() AND table_name = 'oauth_transactions'`,
    );
    expect(columns.map((column) => column.column_name)).toEqual(
      expect.arrayContaining(['transaction_token_hash', 'nonce_hash']),
    );
    expect(columns.map((column) => column.column_name)).not.toEqual(
      expect.arrayContaining(['transaction_token', 'nonce', 'id_token']),
    );

    const common = [
      randomUUID(),
      'a'.repeat(64),
      'b'.repeat(64),
      new Date(Date.now() + 300_000),
    ];
    await expect(
      runner.query(
        `INSERT INTO oauth_transactions
          (id, provider, operation, consumer, audience, transaction_token_hash, nonce_hash, expires_at)
         VALUES ($1, 'google', 'signup', 'web', 'client', $2, $3, $4)`,
        common,
      ),
    ).rejects.toMatchObject({ code: '23514' });
  });
});
