import { randomBytes, randomUUID } from 'node:crypto';
import { env } from 'node:process';

import { ConfigService } from '@nestjs/config';
import { DataSource, QueryRunner } from 'typeorm';

import { AuthChallengeDeliveryService } from '../../modules/auth/challenges/auth-challenge-delivery.service';
import { AuthChallengePurpose } from '../../modules/auth/challenges/auth-challenge.entity';
import { AuthChallengeService } from '../../modules/auth/challenges/auth-challenge.service';
import { AuthRateLimitService } from '../../modules/auth/challenges/auth-rate-limit.service';
import { EmailService } from '../../modules/email/email.service';
import { User } from '../../modules/user/entities/user.entity';
import { AuthChallengeFoundation1793000000000 } from '../migrations/1793000000000-AuthChallengeFoundation';
import { DurableAuthChallengeDelivery1793005000000 } from '../migrations/1793005000000-DurableAuthChallengeDelivery';

const integration = env.PG_INTEGRATION_URL ? describe : describe.skip;
const PEPPER = 'auth-challenge-test-key-please-do-not-use-in-production';

integration('Purpose-bound auth challenges on PostgreSQL', () => {
  let dataSource: DataSource;
  let runner: QueryRunner;
  let schemaName: string;
  let userId: string;
  let challenges: AuthChallengeService;
  let rateLimits: AuthRateLimitService;

  beforeAll(async () => {
    dataSource = new DataSource({
      type: 'postgres',
      url: env.PG_INTEGRATION_URL,
      synchronize: false,
    });
    await dataSource.initialize();
    await dataSource.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
    const config = { get: () => PEPPER } as unknown as ConfigService;
    challenges = new AuthChallengeService(dataSource, config);
    rateLimits = new AuthRateLimitService(dataSource, config);
  });

  beforeEach(async () => {
    schemaName = 'auth_challenge_' + randomUUID().replaceAll('-', '');
    userId = randomUUID();
    await dataSource.query(`CREATE SCHEMA "\${schemaName}"`);
    runner = dataSource.createQueryRunner();
    await runner.connect();
    await runner.query(`SET search_path TO "\${schemaName}", public`);
    await runner.startTransaction();
    await runner.query('CREATE TABLE users (id uuid PRIMARY KEY)');
    await runner.query('INSERT INTO users (id) VALUES ($1)', [userId]);
    await new AuthChallengeFoundation1793000000000().up(runner);
    await new DurableAuthChallengeDelivery1793005000000().up(runner);
  });

  afterEach(async () => {
    if (runner?.isTransactionActive) await runner.rollbackTransaction();
    await runner?.release();
    if (schemaName) {
      await dataSource.query(`DROP SCHEMA IF EXISTS "\${schemaName}" CASCADE`);
    }
  });

  afterAll(async () => {
    if (dataSource?.isInitialized) await dataSource.destroy();
  });

  it('stages an encrypted recoverable email envelope in the challenge transaction', async () => {
    const key = randomBytes(32).toString('base64');
    const delivery = new AuthChallengeDeliveryService(
      dataSource,
      {
        get: (name: string) =>
          name === 'AUTH_CHALLENGE_DELIVERY_KEY' ? key : PEPPER,
      } as unknown as ConfigService,
      challenges,
      { sendMail: jest.fn() } as unknown as EmailService,
    );
    const receipt = await delivery.queueInTransaction(
      runner.manager,
      { id: userId } as User,
      AuthChallengePurpose.CONTACT_VERIFICATION,
    );
    const envelopes: Array<Record<string, unknown>> = await runner.query(
      'SELECT * FROM auth_challenge_deliveries',
    );
    expect(envelopes).toHaveLength(1);
    expect(envelopes[0]).toMatchObject({
      challenge_id: receipt.challengeId,
      status: 'pending',
      attempts: 0,
    });
    expect(envelopes[0].iv).toMatch(/^[a-f0-9]{24}$/);
    expect(envelopes[0].tag).toMatch(/^[a-f0-9]{32}$/);
    expect(envelopes[0].ciphertext).toMatch(/^[a-f0-9]{12}$/);
    expect(JSON.stringify(envelopes)).not.toContain(key);
    const rows: Array<{ id: string }> = await runner.query(
      'SELECT id FROM auth_challenges',
    );
    expect(rows).toEqual([{ id: receipt.challengeId }]);
  });

  it('stores an allowlisted purpose, opaque ID and keyed digest, never the code', async () => {
    const challenge = await challenges.issueInTransaction(
      runner.manager,
      userId,
      AuthChallengePurpose.CONTACT_VERIFICATION,
    );
    const rows: Array<Record<string, unknown>> = await runner.query(
      'SELECT * FROM auth_challenges',
    );
    expect(challenge.challengeId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
    expect(challenge.code).toMatch(/^\d{6}$/);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id: challenge.challengeId,
      subject_user_id: userId,
      purpose: AuthChallengePurpose.CONTACT_VERIFICATION,
      attempt_count: 0,
      consumed_at: null,
    });
    expect(rows[0].secret_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(rows)).not.toContain(challenge.code);
    expect(Object.keys(rows[0]).sort()).toEqual(
      [
        'id',
        'purpose',
        'subject_user_id',
        'secret_hash',
        'issued_at',
        'expires_at',
        'attempt_count',
        'consumed_at',
      ].sort(),
    );
  });

  it('separates recovery from contact-verification challenges', async () => {
    const verification = await challenges.issueInTransaction(
      runner.manager,
      userId,
      AuthChallengePurpose.CONTACT_VERIFICATION,
    );
    const recovery = await challenges.issueInTransaction(
      runner.manager,
      userId,
      AuthChallengePurpose.PASSWORD_RECOVERY,
    );
    expect(
      await challenges.consumeInTransaction(
        runner.manager,
        recovery.challengeId,
        AuthChallengePurpose.CONTACT_VERIFICATION,
        recovery.code,
      ),
    ).toBeNull();
    expect(
      await challenges.consumeInTransaction(
        runner.manager,
        verification.challengeId,
        AuthChallengePurpose.CONTACT_VERIFICATION,
        verification.code,
      ),
    ).toBe(userId);
    expect(
      await challenges.consumeInTransaction(
        runner.manager,
        recovery.challengeId,
        AuthChallengePurpose.PASSWORD_RECOVERY,
        recovery.code,
      ),
    ).toBe(userId);
  });

  it('records bad guesses, locks after five, and rejects a subsequent correct code', async () => {
    const created = await challenges.issueInTransaction(
      runner.manager,
      userId,
      AuthChallengePurpose.PASSWORD_RECOVERY,
    );
    const wrong = created.code === '999999' ? '999998' : '999999';
    for (let attempt = 0; attempt < 5; attempt++) {
      expect(
        await challenges.consumeInTransaction(
          runner.manager,
          created.challengeId,
          AuthChallengePurpose.PASSWORD_RECOVERY,
          wrong,
        ),
      ).toBeNull();
    }
    expect(
      await challenges.consumeInTransaction(
        runner.manager,
        created.challengeId,
        AuthChallengePurpose.PASSWORD_RECOVERY,
        created.code,
      ),
    ).toBeNull();
    const rows: Array<{ attempt_count: number; consumed_at: Date }> =
      await runner.query(
        'SELECT attempt_count, consumed_at FROM auth_challenges WHERE id = $1',
        [created.challengeId],
      );
    expect(rows[0].attempt_count).toBe(5);
    expect(rows[0].consumed_at).toBeInstanceOf(Date);
  });

  it('enforces resend cooldown and invalidates the older usable challenge', async () => {
    const first = await challenges.issueInTransaction(
      runner.manager,
      userId,
      AuthChallengePurpose.CONTACT_VERIFICATION,
    );
    await expect(
      challenges.issueInTransaction(
        runner.manager,
        userId,
        AuthChallengePurpose.CONTACT_VERIFICATION,
      ),
    ).rejects.toThrow('Please wait');
    await runner.query(
      `UPDATE auth_challenges SET issued_at = now() - interval '61 seconds'
       WHERE id = $1`,
      [first.challengeId],
    );
    const second = await challenges.issueInTransaction(
      runner.manager,
      userId,
      AuthChallengePurpose.CONTACT_VERIFICATION,
    );
    expect(second.challengeId).not.toBe(first.challengeId);
    expect(
      await challenges.consumeInTransaction(
        runner.manager,
        first.challengeId,
        AuthChallengePurpose.CONTACT_VERIFICATION,
        first.code,
      ),
    ).toBeNull();
    expect(
      await challenges.consumeInTransaction(
        runner.manager,
        second.challengeId,
        AuthChallengePurpose.CONTACT_VERIFICATION,
        second.code,
      ),
    ).toBe(userId);
  });

  it('rejects expired challenges and replay after successful consumption', async () => {
    const expired = await challenges.issueInTransaction(
      runner.manager,
      userId,
      AuthChallengePurpose.CONTACT_VERIFICATION,
    );
    await runner.query(
      `UPDATE auth_challenges SET
       issued_at = now() - interval '20 minutes',
       expires_at = now() - interval '10 minutes' WHERE id = $1`,
      [expired.challengeId],
    );
    expect(
      await challenges.consumeInTransaction(
        runner.manager,
        expired.challengeId,
        AuthChallengePurpose.CONTACT_VERIFICATION,
        expired.code,
      ),
    ).toBeNull();
    const second = await challenges.issueInTransaction(
      runner.manager,
      userId,
      AuthChallengePurpose.CONTACT_VERIFICATION,
    );
    expect(
      await challenges.consumeInTransaction(
        runner.manager,
        second.challengeId,
        AuthChallengePurpose.CONTACT_VERIFICATION,
        second.code,
      ),
    ).toBe(userId);
    expect(
      await challenges.consumeInTransaction(
        runner.manager,
        second.challengeId,
        AuthChallengePurpose.CONTACT_VERIFICATION,
        second.code,
      ),
    ).toBeNull();
  });

  it('rolls back consumed state along with a failed protected mutation', async () => {
    const challenge = await challenges.issueInTransaction(
      runner.manager,
      userId,
      AuthChallengePurpose.CONTACT_VERIFICATION,
    );
    await runner.query('SAVEPOINT failed_mutation');
    expect(
      await challenges.consumeInTransaction(
        runner.manager,
        challenge.challengeId,
        AuthChallengePurpose.CONTACT_VERIFICATION,
        challenge.code,
      ),
    ).toBe(userId);
    await runner.query('ROLLBACK TO SAVEPOINT failed_mutation');
    const rows: Array<{ consumed_at: Date | null }> = await runner.query(
      'SELECT consumed_at FROM auth_challenges WHERE id = $1',
      [challenge.challengeId],
    );
    expect(rows[0].consumed_at).toBeNull();
  });

  it('enforces shared hashed rate-limit budgets and opens a new window', async () => {
    const key = '203.0.113.9';
    const first = await rateLimits.consumeInTransaction(
      runner.manager,
      'auth:login',
      key,
      2,
      60,
    );
    const second = await rateLimits.consumeInTransaction(
      runner.manager,
      'auth:login',
      key,
      2,
      60,
    );
    const third = await rateLimits.consumeInTransaction(
      runner.manager,
      'auth:login',
      key,
      2,
      60,
    );
    expect([first.allowed, second.allowed, third.allowed]).toEqual([
      true,
      true,
      false,
    ]);
    expect(third.retryAfterSeconds).toBeGreaterThan(0);
    const buckets: Array<{ key_hash: string; hits: number }> =
      await runner.query('SELECT key_hash, hits FROM auth_rate_limit_buckets');
    expect(buckets).toHaveLength(1);
    expect(buckets[0].key_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(buckets)).not.toContain(key);
    await runner.query(
      `UPDATE auth_rate_limit_buckets
       SET window_ends_at = now() - interval '1 second'`,
    );
    const next = await rateLimits.consumeInTransaction(
      runner.manager,
      'auth:login',
      key,
      2,
      60,
    );
    expect(next).toMatchObject({ allowed: true, hits: 1 });
  });
});
