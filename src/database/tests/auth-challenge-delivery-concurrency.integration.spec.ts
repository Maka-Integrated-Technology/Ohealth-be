import { randomBytes, randomUUID } from 'node:crypto';
import { env } from 'node:process';

import { ConfigService } from '@nestjs/config';
import { DataSource, QueryRunner } from 'typeorm';

import { AuthChallengeDeliveryService } from '../../modules/auth/challenges/auth-challenge-delivery.service';
import { AuthChallengePurpose } from '../../modules/auth/challenges/auth-challenge.entity';
import { AuthChallengeService } from '../../modules/auth/challenges/auth-challenge.service';
import { EmailService } from '../../modules/email/email.service';
import { User } from '../../modules/user/entities/user.entity';
import { AuthChallengeFoundation1793000000000 } from '../migrations/1793000000000-AuthChallengeFoundation';
import { DurableAuthChallengeDelivery1793005000000 } from '../migrations/1793005000000-DurableAuthChallengeDelivery';
import { LeasedAuthChallengeDelivery1793006000000 } from '../migrations/1793006000000-LeasedAuthChallengeDelivery';
import { AuthChallengeWorkerHeartbeat1793007000000 } from '../migrations/1793007000000-AuthChallengeWorkerHeartbeat';

const integration = env.PG_INTEGRATION_URL ? describe : describe.skip;

integration('Delivery leases across independent PostgreSQL connections', () => {
  let admin: DataSource;
  let db: DataSource;
  let schema: string;
  let delivery: AuthChallengeDeliveryService;
  let mail: jest.Mock;

  beforeAll(async () => {
    schema = 'auth_delivery_' + randomUUID().replaceAll('-', '');
    admin = new DataSource({
      type: 'postgres',
      url: env.PG_INTEGRATION_URL,
      synchronize: false,
    });
    await admin.initialize();
    await admin.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
    await admin.query('CREATE SCHEMA "' + schema + '"');
    // A one-connection pool would deadlock any simultaneous worker if mail
    // kept a transaction/connection checked out during the provider wait.
    db = new DataSource({
      type: 'postgres',
      url: env.PG_INTEGRATION_URL,
      synchronize: false,
      extra: { options: '-c search_path=' + schema + ',public', max: 1 },
    });
    await db.initialize();
    await db.query(
      'CREATE TABLE users (id uuid PRIMARY KEY, email text, first_name text)',
    );
    const runner: QueryRunner = db.createQueryRunner();
    await runner.connect();
    try {
      await new AuthChallengeFoundation1793000000000().up(runner);
      await new DurableAuthChallengeDelivery1793005000000().up(runner);
      await new LeasedAuthChallengeDelivery1793006000000().up(runner);
      await new AuthChallengeWorkerHeartbeat1793007000000().up(runner);
    } finally {
      await runner.release();
    }
    const key = randomBytes(32).toString('base64');
    const settings = {
      get: (name: string) => {
        if (name === 'AUTH_CHALLENGE_PEPPER') {
          return 'integration-test-pepper-not-for-production-at-all';
        }
        if (name === 'AUTH_CHALLENGE_DELIVERY_KEY') return key;
        if (name === 'mail.from.address') return 'test@example.test';
        if (name === 'mail.from.name') return 'OHealth';
        if (name === 'app.name') return 'OHealth';
        return undefined;
      },
    } as ConfigService;
    const challenges = new AuthChallengeService(db, settings);
    mail = jest.fn().mockResolvedValue(undefined);
    delivery = new AuthChallengeDeliveryService(db, settings, challenges, {
      sendMail: (...args: unknown[]) => mail(...args),
    } as unknown as EmailService);
  });

  afterAll(async () => {
    if (db?.isInitialized) await db.destroy();
    if (admin?.isInitialized) {
      await admin.query('DROP SCHEMA IF EXISTS "' + schema + '" CASCADE');
      await admin.destroy();
    }
  });

  async function queue(): Promise<string> {
    const id = randomUUID();
    await db.query(
      'INSERT INTO users (id, email, first_name) VALUES ($1, $2, $3)',
      [id, 'challenge+' + id + '@example.test', 'Ada'],
    );
    const result = await db.transaction((manager) =>
      delivery.queueInTransaction(
        manager,
        { id } as User,
        AuthChallengePurpose.CONTACT_VERIFICATION,
      ),
    );
    return result.challengeId;
  }

  it('releases the sole DB connection before blocking on provider I/O', async () => {
    const challengeId = await queue();
    let unlock: () => void = () => undefined;
    let reachedProvider: () => void = () => undefined;
    const entered = new Promise<void>((resolve) => {
      reachedProvider = resolve;
    });
    const blocked = new Promise<void>((resolve) => {
      unlock = resolve;
    });
    mail.mockImplementationOnce(async () => {
      reachedProvider();
      await blocked;
    });
    const first = delivery.dispatchBatch(1);
    await entered;
    try {
      const second = Promise.race([
        delivery.dispatchBatch(1),
        new Promise<never>((_resolve, reject) => {
          setTimeout(
            () => reject(new Error('DB pool held during provider I/O')),
            1500,
          );
        }),
      ]);
      expect(await second).toEqual({
        accepted: 0,
        retried: 0,
        discarded: 0,
      });
      const rows: Array<{ status: string }> = await db.query(
        'SELECT status FROM auth_challenge_deliveries WHERE challenge_id = $1',
        [challengeId],
      );
      expect(rows[0].status).toBe('processing');
    } finally {
      unlock();
    }
    expect(await first).toMatchObject({ accepted: 1 });
    expect(mail).toHaveBeenCalledTimes(1);
    const rows: Array<{ status: string; ciphertext: string | null }> =
      await db.query(
        'SELECT status, ciphertext FROM auth_challenge_deliveries WHERE challenge_id = $1',
        [challengeId],
      );
    expect(rows).toEqual([{ status: 'accepted', ciphertext: null }]);
  }, 15_000);

  it('reclaims expired leases and prevents stale tokens from persisting', async () => {
    const id = await queue();
    const oldToken = randomUUID();
    await db.query(
      "UPDATE auth_challenge_deliveries SET status = 'processing', " +
        "attempts = 1, lease_token = $2, lease_expires_at = now() - interval '1 minute' " +
        'WHERE challenge_id = $1',
      [id, oldToken],
    );
    expect(await delivery.dispatchBatch(1)).toMatchObject({ accepted: 1 });
    const rows: Array<{
      status: string;
      attempts: number;
      lease_token: string | null;
    }> = await db.query(
      'SELECT status, attempts, lease_token FROM auth_challenge_deliveries WHERE challenge_id = $1',
      [id],
    );
    expect(rows).toEqual([
      { status: 'accepted', attempts: 2, lease_token: null },
    ]);
  });
});
