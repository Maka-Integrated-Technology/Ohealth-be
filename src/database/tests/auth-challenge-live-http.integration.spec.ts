import { randomBytes, randomUUID } from 'node:crypto';
import { env } from 'node:process';

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import * as request from 'supertest';
import { DataSource, QueryRunner } from 'typeorm';

import { AccountAccessPolicyService } from '../../modules/auth/account-access-policy.service';
import { AuthRoutingService } from '../../modules/auth/auth-routing.service';
import { AuthController } from '../../modules/auth/auth.controller';
import { AuthService } from '../../modules/auth/auth.service';
import { AuthAbuseGuard } from '../../modules/auth/challenges/auth-abuse.guard';
import { AuthChallengeDeliveryService } from '../../modules/auth/challenges/auth-challenge-delivery.service';
import { AuthChallengeService } from '../../modules/auth/challenges/auth-challenge.service';
import { AuthRateLimitService } from '../../modules/auth/challenges/auth-rate-limit.service';
import { SecureAuthChallengeFlowsService } from '../../modules/auth/challenges/secure-auth-challenge-flows.service';
import { AuthSession } from '../../modules/auth/entities/auth.entity';
import { JwtAuthGuard } from '../../modules/auth/guards/jwt-auth.guard';
import { PasswordCredentialsService } from '../../modules/auth/password-policy/password-credentials.service';
import { AuthSecurityAuditService } from '../../modules/auth/security-audit/auth-security-audit.service';
import { EmailService } from '../../modules/email/email.service';
import { User } from '../../modules/user/entities/user.entity';
import { UserService } from '../../modules/user/user.service';
import { AuthChallengeFoundation1793000000000 } from '../migrations/1793000000000-AuthChallengeFoundation';
import { DurableAuthChallengeDelivery1793005000000 } from '../migrations/1793005000000-DurableAuthChallengeDelivery';
import { LeasedAuthChallengeDelivery1793006000000 } from '../migrations/1793006000000-LeasedAuthChallengeDelivery';
import { AuthChallengeWorkerHeartbeat1793007000000 } from '../migrations/1793007000000-AuthChallengeWorkerHeartbeat';

// This suite deliberately uses the production controller, AuthService, abuse
// guard, limit, challenge, delivery and audit services against real PostgreSQL.
// JWT issuance and outgoing SMTP are the only external adapters replaced.
const integration = env.PG_INTEGRATION_URL ? describe : describe.skip;
const pepper = 'live-http-integration-pepper-not-for-production';
const encryptionKey = randomBytes(32).toString('base64');
const publicMessage =
  'If this account is eligible, a verification message has been queued.';

integration('Live challenge routes on actual HTTP and PostgreSQL', () => {
  let admin: DataSource;
  let database: DataSource;
  let app: INestApplication;
  let schema: string;
  let delivery: AuthChallengeDeliveryService;
  let config: ConfigService;
  const mail = jest.fn().mockResolvedValue(undefined);

  beforeAll(async () => {
    schema = 'auth_live_' + randomUUID().replaceAll('-', '');
    admin = new DataSource({ type: 'postgres', url: env.PG_INTEGRATION_URL });
    await admin.initialize();
    await admin.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
    await admin.query('CREATE SCHEMA "' + schema + '"');

    database = new DataSource({
      type: 'postgres',
      url: env.PG_INTEGRATION_URL,
      entities: [__dirname + '/../../modules/**/*.entity.ts'],
      synchronize: false,
      extra: { options: '-c search_path=' + schema + ',public' },
    });
    await database.initialize();
    await database.query(
      'CREATE TABLE users (' +
        'id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), ' +
        'email varchar NOT NULL UNIQUE, password varchar NOT NULL, ' +
        'first_name varchar NOT NULL, last_name varchar NOT NULL, ' +
        'middle_name varchar, gender varchar, dob date, phone varchar, ' +
        "country varchar, image varchar, role varchar NOT NULL DEFAULT 'PATIENT', " +
        "account_status varchar NOT NULL DEFAULT 'pending_verification', " +
        'is_active boolean NOT NULL DEFAULT false, is_verified boolean NOT NULL DEFAULT false, ' +
        'email_verified_at timestamptz, verification_code varchar, ' +
        'verification_code_expires_at timestamptz, google_id varchar, ' +
        'reset_token varchar, reset_token_expiry timestamptz, ' +
        'created_at timestamptz NOT NULL DEFAULT now(), ' +
        'updated_at timestamptz NOT NULL DEFAULT now())',
    );
    await database.query(
      'CREATE TABLE auth_sessions (' +
        'id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), ' +
        'session_id varchar NOT NULL UNIQUE, user_id uuid NOT NULL REFERENCES users(id), ' +
        'refresh_token_hash varchar NOT NULL, expires_at timestamptz NOT NULL, ' +
        'revoked_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), ' +
        'updated_at timestamptz NOT NULL DEFAULT now())',
    );
    await database.query(
      'CREATE TABLE user_account_status_history (' +
        'id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), user_id uuid NOT NULL, ' +
        'previous_status varchar, new_status varchar NOT NULL, ' +
        'changed_by_user_id uuid, reason text NOT NULL, ' +
        'changed_at timestamptz NOT NULL DEFAULT now())',
    );
    await database.query(
      'CREATE TABLE auth_security_events (' +
        'id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), ' +
        'event_type varchar NOT NULL, outcome varchar NOT NULL, ' +
        "request_source varchar NOT NULL DEFAULT 'unknown', " +
        'actor_user_id uuid, subject_user_id uuid, session_id uuid, ' +
        'occurred_at timestamptz NOT NULL DEFAULT now())',
    );
    const runner: QueryRunner = database.createQueryRunner();
    await runner.connect();
    try {
      await new AuthChallengeFoundation1793000000000().up(runner);
      await new DurableAuthChallengeDelivery1793005000000().up(runner);
      await new LeasedAuthChallengeDelivery1793006000000().up(runner);
      await new AuthChallengeWorkerHeartbeat1793007000000().up(runner);
    } finally {
      await runner.release();
    }
    await healthyWorker();
    const values = new Map<string, string>([
      ['AUTH_CHALLENGE_PEPPER', pepper],
      ['AUTH_CHALLENGE_DELIVERY_KEY', encryptionKey],
      ['AUTH_CHALLENGE_FLOWS_ENABLED', 'true'],
      ['AUTH_TRUSTED_PROXY_CIDRS', ''],
      ['HASH_SALT', '10'],
      ['JWT_SECRET', 'integration-only-access-secret'],
      ['JWT_REFRESH_SECRET', 'integration-only-refresh-secret'],
      ['mail.from.address', 'sender@example.test'],
      ['mail.from.name', 'OHealth'],
      ['app.name', 'OHealth'],
    ]);
    config = {
      get: (key: string, fallback?: unknown) => values.get(key) ?? fallback,
    } as ConfigService;

    const module = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        AuthService,
        UserService,
        AccountAccessPolicyService,
        AuthAbuseGuard,
        AuthChallengeService,
        AuthRateLimitService,
        AuthChallengeDeliveryService,
        SecureAuthChallengeFlowsService,
        AuthSecurityAuditService,
        PasswordCredentialsService,
        { provide: DataSource, useValue: database },
        { provide: ConfigService, useValue: config },
        {
          provide: getRepositoryToken(User),
          useValue: database.getRepository(User),
        },
        {
          provide: getRepositoryToken(AuthSession),
          useValue: database.getRepository(AuthSession),
        },
        {
          provide: JwtService,
          useValue: { signAsync: jest.fn().mockResolvedValue('test-jwt') },
        },
        { provide: EmailService, useValue: { sendMail: mail } },
        {
          provide: AuthRoutingService,
          useValue: { resolve: jest.fn().mockResolvedValue({}) },
        },
        { provide: JwtAuthGuard, useValue: { canActivate: () => false } },
        {
          provide: WINSTON_MODULE_PROVIDER,
          useValue: {
            child: () => ({
              info: jest.fn(),
              warn: jest.fn(),
              error: jest.fn(),
            }),
          },
        },
      ],
    }).compile();

    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
    delivery = app.get(AuthChallengeDeliveryService);
  }, 30_000);

  afterAll(async () => {
    await app?.close();
    if (database?.isInitialized) await database.destroy();
    if (admin?.isInitialized) {
      await admin.query('DROP SCHEMA IF EXISTS "' + schema + '" CASCADE');
      await admin.destroy();
    }
  });

  beforeEach(async () => {
    mail.mockReset().mockResolvedValue(undefined);
    await database.query(
      'TRUNCATE auth_challenge_deliveries, auth_challenges, auth_rate_limit_buckets',
    );
    await healthyWorker();
  });

  async function healthyWorker(): Promise<void> {
    await database.query(
      'INSERT INTO auth_challenge_worker_heartbeat ' +
        '(id, last_seen_at, pending, oldest_pending_seconds, expired_leases) ' +
        "VALUES ('delivery', now(), 0, 0, 0) " +
        'ON CONFLICT (id) DO UPDATE SET last_seen_at = now(), ' +
        'pending = 0, oldest_pending_seconds = 0, expired_leases = 0',
    );
  }

  async function createUser(
    name: string,
    status: 'pending_verification' | 'active' | 'suspended' | 'deactivated',
  ): Promise<{ id: string; email: string }> {
    const id = randomUUID();
    const email = name + '+' + id + '@example.test';
    const active = status === 'active';
    await database.query(
      'INSERT INTO users ' +
        '(id, email, password, first_name, last_name, role, account_status, ' +
        'is_active, is_verified, email_verified_at) ' +
        'VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)',
      [
        id,
        email,
        'unused-password-hash',
        'Ada',
        'User',
        'PATIENT',
        status,
        active,
        active,
        active ? new Date() : null,
      ],
    );
    return { id, email };
  }

  it('returns the same public message for unknown, pending, active and suspended resend targets', async () => {
    const pending = await createUser('pending-resend', 'pending_verification');
    const active = await createUser('active-resend', 'active');
    const suspended = await createUser('suspended-resend', 'suspended');
    const unknown = 'missing+' + randomUUID() + '@example.test';
    const results = [];
    for (const email of [
      unknown,
      pending.email,
      active.email,
      suspended.email,
    ]) {
      const response = await request(app.getHttpServer())
        .post('/api/auth/verify/resend')
        .send({ email })
        .expect(200);
      results.push(response.body);
    }
    expect(results).toEqual([
      {
        message: publicMessage,
      },
      { message: publicMessage },
      { message: publicMessage },
      { message: publicMessage },
    ]);
    const issued: Array<{ subject_user_id: string }> = await database.query(
      'SELECT subject_user_id FROM auth_challenges WHERE purpose = $1 AND subject_user_id = $2',
      ['contact_verification', pending.id],
    );
    expect(issued).toHaveLength(1);
  }, 15_000);

  it('uses the real guard and PostgreSQL counter for concurrent distributed budgets', async () => {
    const instances = Array.from({ length: 9 }, () =>
      request(app.getHttpServer())
        .post('/api/auth/verify/resend')
        .send({ email: 'unknown+' + randomUUID() + '@example.test' }),
    );
    const responses = await Promise.all(instances);
    expect(
      responses.filter((response) => response.status === 200),
    ).toHaveLength(8);
    expect(
      responses.filter((response) => response.status === 429),
    ).toHaveLength(1);
    const ipBucket: Array<{ hits: number }> = await database.query(
      'SELECT hits FROM auth_rate_limit_buckets WHERE hits = 9',
    );
    expect(ipBucket).toHaveLength(1);
  }, 20_000);

  it('fails closed before account lookup for both known and unknown users when worker is stale', async () => {
    const active = await createUser('worker-down', 'active');
    await database.query(
      "UPDATE auth_challenge_worker_heartbeat SET last_seen_at = now() - interval '90 seconds'",
    );
    const unknown = await request(app.getHttpServer())
      .post('/api/auth/forgot-password')
      .send({ email: 'absent+' + randomUUID() + '@example.test' })
      .expect(500);
    const known = await request(app.getHttpServer())
      .post('/api/auth/forgot-password')
      .send({ email: active.email })
      .expect(500);
    expect(known.body.statusCode).toBe(unknown.body.statusCode);
    const rows: Array<{ count: number }> = await database.query(
      'SELECT count(*)::int AS count FROM auth_challenges WHERE subject_user_id = $1',
      [active.id],
    );
    expect(rows[0].count).toBe(0);
  }, 15_000);

  it('consumes recovery exactly once and revokes the persisted session through real HTTP', async () => {
    const active = await createUser('password-recovery', 'active');
    await request(app.getHttpServer())
      .post('/api/auth/forgot-password')
      .send({ email: active.email })
      .expect(201);
    const deliveries: Array<{ challenge_id: string }> = await database.query(
      'SELECT d.challenge_id FROM auth_challenge_deliveries d ' +
        'JOIN auth_challenges c ON c.id = d.challenge_id ' +
        'WHERE c.subject_user_id = $1',
      [active.id],
    );
    expect(deliveries).toHaveLength(1);
    expect(await delivery.dispatchBatch(1)).toMatchObject({ accepted: 1 });
    const mailed = mail.mock.calls[0][0] as {
      templateData: { otp: string; challenge_id: string };
    };
    expect(mailed.templateData.challenge_id).toBe(deliveries[0].challenge_id);
    await database.query(
      'INSERT INTO auth_sessions (session_id, user_id, refresh_token_hash, expires_at) ' +
        "VALUES ($1, $2, 'hash', now() + interval '1 day')",
      [randomUUID(), active.id],
    );
    const payload = {
      challenge_id: deliveries[0].challenge_id,
      code: mailed.templateData.otp,
      newPassword: 'a memorable replacement passphrase',
    };
    await request(app.getHttpServer())
      .post('/api/auth/reset-password')
      .send(payload)
      .expect(201);
    const saved: Array<{ password: string; revoked_at: Date }> =
      await database.query(
        'SELECT u.password, s.revoked_at FROM users u JOIN auth_sessions s ' +
          'ON s.user_id = u.id WHERE u.id = $1',
        [active.id],
      );
    expect(saved).toHaveLength(1);
    expect(saved[0].password).not.toBe('unused-password-hash');
    expect(saved[0].revoked_at).toBeTruthy();
    await request(app.getHttpServer())
      .post('/api/auth/reset-password')
      .send(payload)
      .expect(400);
  }, 20_000);

  it('registers and verifies contact through the real HTTP service, then rejects replay', async () => {
    const email = 'signup+' + randomUUID() + '@example.test';
    const registered = await request(app.getHttpServer())
      .post('/api/auth/signup')
      .send({
        first_name: 'Ada',
        last_name: 'User',
        email,
        role: ['PATIENT'],
        password: 'a memorable patient passphrase',
      })
      .expect(201);
    const challengeId = registered.body.challenge_id as string;
    expect(challengeId).toMatch(/^[a-f0-9-]{36}$/i);
    const before: Array<{
      account_status: string;
      verification_code: string | null;
    }> = await database.query(
      'SELECT account_status, verification_code FROM users WHERE email = $1',
      [email],
    );
    expect(before).toEqual([
      { account_status: 'pending_verification', verification_code: null },
    ]);
    expect(await delivery.dispatchBatch(1)).toMatchObject({ accepted: 1 });
    const mailed = mail.mock.calls[0][0] as {
      templateData: { code: string; challenge_id: string };
    };
    expect(mailed.templateData.challenge_id).toBe(challengeId);

    await request(app.getHttpServer())
      .post('/api/auth/verify')
      .send({ challenge_id: challengeId, code: mailed.templateData.code })
      .expect(200);
    const after: Array<{ account_status: string; count: number }> =
      await database.query(
        'SELECT u.account_status, (SELECT count(*)::int FROM auth_sessions s ' +
          'WHERE s.user_id = u.id) AS count FROM users u WHERE u.email = $1',
        [email],
      );
    expect(after).toEqual([{ account_status: 'active', count: 1 }]);
    await request(app.getHttpServer())
      .post('/api/auth/verify')
      .send({ challenge_id: challengeId, code: mailed.templateData.code })
      .expect(400);
    const history: Array<{ reason: string }> = await database.query(
      'SELECT reason FROM user_account_status_history h ' +
        'JOIN users u ON u.id = h.user_id WHERE u.email = $1',
      [email],
    );
    expect(history).toEqual([{ reason: 'verified_contact_challenge' }]);
  }, 20_000);

  it('rejects recovery proof used for contact verification without consuming it', async () => {
    const user = await createUser('purpose-isolation', 'active');
    await request(app.getHttpServer())
      .post('/api/auth/forgot-password')
      .send({ email: user.email })
      .expect(201);
    expect(await delivery.dispatchBatch(1)).toMatchObject({ accepted: 1 });
    const mailed = mail.mock.calls[0][0] as {
      templateData: { otp: string; challenge_id: string };
    };
    const { challenge_id: challengeId, otp } = mailed.templateData;
    await request(app.getHttpServer())
      .post('/api/auth/verify')
      .send({ challenge_id: challengeId, code: otp })
      .expect(400);
    const rows: Array<{ consumed_at: Date | null }> = await database.query(
      'SELECT consumed_at FROM auth_challenges WHERE id = $1',
      [challengeId],
    );
    expect(rows[0].consumed_at).toBeNull();
  }, 15_000);

  it('serializes simultaneous resend and supersedes the older challenge after cooldown', async () => {
    const user = await createUser('racing-resend', 'pending_verification');
    const replies = await Promise.all(
      [0, 1].map(() =>
        request(app.getHttpServer())
          .post('/api/auth/verify/resend')
          .send({ email: user.email }),
      ),
    );
    expect(replies.map((reply) => reply.status)).toEqual([200, 200]);
    let rows: Array<{ id: string; consumed_at: Date | null }> =
      await database.query(
        'SELECT id, consumed_at FROM auth_challenges WHERE subject_user_id = $1',
        [user.id],
      );
    expect(rows).toHaveLength(1);
    const firstId = rows[0].id;
    await database.query(
      "UPDATE auth_challenges SET issued_at = now() - interval '61 seconds' " +
        'WHERE id = $1',
      [firstId],
    );
    await request(app.getHttpServer())
      .post('/api/auth/verify/resend')
      .send({ email: user.email })
      .expect(200);
    rows = await database.query(
      'SELECT id, consumed_at FROM auth_challenges WHERE subject_user_id = $1',
      [user.id],
    );
    expect(rows).toHaveLength(2);
    expect(rows.filter((row) => row.consumed_at === null)).toHaveLength(1);
    expect(rows.find((row) => row.id === firstId)?.consumed_at).toBeTruthy();
  }, 15_000);

  it('enforces the same PostgreSQL budget across two independent service instances', async () => {
    const other = new DataSource({
      type: 'postgres',
      url: env.PG_INTEGRATION_URL,
      synchronize: false,
      extra: { options: '-c search_path=' + schema + ',public' },
    });
    await other.initialize();
    try {
      const first = app.get(AuthRateLimitService);
      const second = new AuthRateLimitService(other, config);
      const outcomes = await Promise.all(
        Array.from({ length: 10 }, (_, i) =>
          (i % 2 ? first : second).consume(
            'auth:cross-instance-test',
            'shared-test-key',
            4,
            60,
          ),
        ),
      );
      expect(outcomes.filter((result) => result.allowed)).toHaveLength(4);
      expect(outcomes.filter((result) => !result.allowed)).toHaveLength(6);
    } finally {
      await other.destroy();
    }
  }, 15_000);

});
