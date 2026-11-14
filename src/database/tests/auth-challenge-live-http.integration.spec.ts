import { randomBytes, randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { env } from 'node:process';

import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import {
  WINSTON_MODULE_NEST_PROVIDER,
  WINSTON_MODULE_PROVIDER,
} from 'nest-winston';
import * as request from 'supertest';
import { DataSource, QueryRunner } from 'typeorm';

import { GlobalExceptionFilter } from '../../common/exceptions/filters/global-exception.filter';
import { TransformInterceptor } from '../../common/interceptors/transform.interceptor';
import { AccountAccessPolicyService } from '../../modules/auth/account-access-policy.service';
import { AuthController } from '../../modules/auth/auth.controller';
import { AuthService } from '../../modules/auth/auth.service';
import { BrowserSessionCookieService } from '../../modules/auth/browser/browser-session-cookie.service';
import { BrowserSessionTransportService } from '../../modules/auth/browser/browser-session-transport.service';
import { BrowserSessionConfig } from '../../modules/auth/browser/browser-session.config';
import { BrowserSessionController } from '../../modules/auth/browser/browser-session.controller';
import { BrowserSessionGuard } from '../../modules/auth/browser/browser-session.guard';
import { AuthAbuseGuard } from '../../modules/auth/challenges/auth-abuse.guard';
import { AuthChallengeDeliveryService } from '../../modules/auth/challenges/auth-challenge-delivery.service';
import { AuthChallengeValidationPipe } from '../../modules/auth/challenges/auth-challenge-validation.pipe';
import { AuthChallengePurpose } from '../../modules/auth/challenges/auth-challenge.entity';
import { AuthChallengeService } from '../../modules/auth/challenges/auth-challenge.service';
import { AuthRateLimitService } from '../../modules/auth/challenges/auth-rate-limit.service';
import { SecureAuthChallengeFlowsService } from '../../modules/auth/challenges/secure-auth-challenge-flows.service';
import { AuthSession } from '../../modules/auth/entities/auth.entity';
import { JwtAuthGuard } from '../../modules/auth/guards/jwt-auth.guard';
import { OAuthService } from '../../modules/auth/oauth/oauth.service';
import { PasswordCredentialsService } from '../../modules/auth/password-policy/password-credentials.service';
import { AccountProvisioningService } from '../../modules/auth/registration/account-provisioning.service';
import { RegistrationService } from '../../modules/auth/registration/registration.service';
import { AuthSecurityAuditService } from '../../modules/auth/security-audit/auth-security-audit.service';
import { RefreshSessionService } from '../../modules/auth/sessions/refresh-session.service';
import { JwtStrategy } from '../../modules/auth/strategies/jwt.strategy';
import { EmailService } from '../../modules/email/email.service';
import { User } from '../../modules/user/entities/user.entity';
import { UserService } from '../../modules/user/user.service';
import { AuthChallengeFoundation1793000000000 } from '../migrations/1793000000000-AuthChallengeFoundation';
import { DurableAuthChallengeDelivery1793005000000 } from '../migrations/1793005000000-DurableAuthChallengeDelivery';
import { LeasedAuthChallengeDelivery1793006000000 } from '../migrations/1793006000000-LeasedAuthChallengeDelivery';
import { AuthChallengeWorkerHeartbeat1793007000000 } from '../migrations/1793007000000-AuthChallengeWorkerHeartbeat';
import { CanonicalRefreshSessions1793400000000 } from '../migrations/1793400000000-CanonicalRefreshSessions';
import { LoginVerificationChallenges1793500000000 } from '../migrations/1793500000000-LoginVerificationChallenges';
import { TransactionalIntentRegistration1793600000000 } from '../migrations/1793600000000-TransactionalIntentRegistration';
import { AuthChallengeContinuation1793700000000 } from '../migrations/1793700000000-AuthChallengeContinuation';

// This suite deliberately uses the production controller, AuthService, abuse
// guard, limit, challenge, delivery and audit services against real PostgreSQL.
// Outgoing SMTP and routing are replaced; JWT issuance uses the real adapter.
const integration = env.PG_INTEGRATION_URL ? describe : describe.skip;
const pepper = 'live-http-integration-pepper-not-for-production';
const encryptionKey = randomBytes(32).toString('base64');
const publicMessage =
  'If this account is eligible, a verification message has been queued.';

integration('Live challenge routes on actual HTTP and PostgreSQL', () => {
  let admin: DataSource;
  let database: DataSource;
  let app: INestApplication;
  let secondApp: INestApplication;
  let secondDatabase: DataSource;
  let schema: string;
  let applicationName: string;
  let delivery: AuthChallengeDeliveryService;
  let config: ConfigService;
  const mail = jest.fn().mockResolvedValue(undefined);

  beforeAll(async () => {
    schema = 'auth_live_' + randomUUID().replaceAll('-', '');
    applicationName = 'ohealth_' + schema;
    admin = new DataSource({ type: 'postgres', url: env.PG_INTEGRATION_URL });
    await admin.initialize();
    await admin.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
    await admin.query('CREATE SCHEMA "' + schema + '"');

    database = new DataSource({
      type: 'postgres',
      url: env.PG_INTEGRATION_URL,
      entities: [__dirname + '/../../modules/**/*.entity.ts'],
      synchronize: false,
      extra: {
        options: '-c search_path=' + schema + ',public',
        application_name: applicationName,
      },
    });
    await database.initialize();
    await database.query(
      'CREATE TABLE users (' +
        'id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), ' +
        'email varchar NOT NULL UNIQUE, password varchar NOT NULL, ' +
        'password_authentication_enabled boolean NOT NULL DEFAULT true, ' +
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
        'occurred_at timestamptz NOT NULL DEFAULT now(), ' +
        'CONSTRAINT "CHK_auth_security_events_type" CHECK (' +
        "event_type IN ('sign_in', 'contact_verification', 'password_recovery', " +
        "'password_change', 'session_refresh', 'session_reuse', 'logout', " +
        "'account_state_change', 'oauth_link', 'registration', 'mfa')))",
    );
    await database.query(
      'CREATE TABLE user_personas (' +
        'id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), created_at timestamptz NOT NULL DEFAULT now(), ' +
        'updated_at timestamptz NOT NULL DEFAULT now(), user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, ' +
        'persona_type varchar NOT NULL, is_active boolean NOT NULL DEFAULT true, UNIQUE (user_id, persona_type))',
    );
    await database.query(
      'CREATE TABLE patient_profiles (' +
        'id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), created_at timestamptz NOT NULL DEFAULT now(), ' +
        'updated_at timestamptz NOT NULL DEFAULT now(), user_id uuid NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE, ' +
        'patient_reference varchar, medical_conditions text, allergies text, blood_group varchar, height_cm int, ' +
        'weight_kg double precision, genotype varchar, emergency_contact_name varchar, emergency_contact_phone varchar)',
    );
    await database.query(
      'CREATE TABLE organizations (' +
        'id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), created_at timestamptz NOT NULL DEFAULT now(), ' +
        'updated_at timestamptz NOT NULL DEFAULT now(), organization_type varchar NOT NULL, name varchar NOT NULL, ' +
        'registration_number varchar NOT NULL UNIQUE, location text NOT NULL, contact_email varchar NOT NULL, ' +
        "contact_phone varchar, verification_status varchar NOT NULL DEFAULT 'pending', rejection_reason text, " +
        'is_active boolean NOT NULL DEFAULT true)',
    );
    await database.query(
      'CREATE TABLE organization_memberships (' +
        'id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), created_at timestamptz NOT NULL DEFAULT now(), ' +
        'updated_at timestamptz NOT NULL DEFAULT now(), organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, ' +
        'user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, role varchar NOT NULL, ' +
        "status varchar NOT NULL DEFAULT 'active', permission_overrides jsonb NOT NULL DEFAULT '[]'::jsonb, " +
        'invited_by_user_id uuid, joined_at timestamptz, UNIQUE (organization_id, user_id))',
    );
    await database.query(
      'CREATE TABLE legal_acceptances (' +
        'id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), created_at timestamptz NOT NULL DEFAULT now(), ' +
        'updated_at timestamptz NOT NULL DEFAULT now(), user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, ' +
        'document_type varchar NOT NULL, document_version varchar NOT NULL, accepted_at timestamptz NOT NULL, ' +
        'ip_address inet, user_agent text, UNIQUE (user_id, document_type, document_version))',
    );
    const runner: QueryRunner = database.createQueryRunner();
    await runner.connect();
    try {
      await new CanonicalRefreshSessions1793400000000().up(runner);
      await new AuthChallengeFoundation1793000000000().up(runner);
      await new DurableAuthChallengeDelivery1793005000000().up(runner);
      await new LeasedAuthChallengeDelivery1793006000000().up(runner);
      await new AuthChallengeWorkerHeartbeat1793007000000().up(runner);
      await new LoginVerificationChallenges1793500000000().up(runner);
      await new TransactionalIntentRegistration1793600000000().up(runner);
      await new AuthChallengeContinuation1793700000000().up(runner);
    } finally {
      await runner.release();
    }
    await healthyWorker();
    const values = new Map<string, unknown>([
      ['NODE_ENV', 'production'],
      ['AUTH_BROWSER_SESSION_ENABLED', 'true'],
      ['cors.origins', ['https://app.ohealth.example']],
      ['AUTH_CHALLENGE_PEPPER', pepper],
      ['AUTH_CHALLENGE_DELIVERY_KEY', encryptionKey],
      ['AUTH_CHALLENGE_FLOWS_ENABLED', 'true'],
      ['AUTH_TRUSTED_PROXY_CIDRS', ''],
      ['HASH_SALT', '10'],
      ['JWT_SECRET', 'integration-only-access-secret-at-least-32-chars'],
      ['TOKEN_ACCESS_DURATION', '15m'],
      ['TOKEN_REFRESH_DURATION', '7d'],
      ['mail.from.address', 'sender@example.test'],
      ['mail.from.name', 'OHealth'],
      ['app.name', 'OHealth'],
      [
        'auth.recoveryContinuationUrl',
        'https://app.ohealth.test/reset-password',
      ],
      ['registration.termsVersion', 'terms-v1'],
      ['registration.privacyVersion', 'privacy-v1'],
      ['registration.idempotencyPepper', 'r'.repeat(32)],
    ]);
    config = {
      get: (key: string, fallback?: unknown) => values.get(key) ?? fallback,
    } as ConfigService;

    app = await createApp(database);
    secondDatabase = new DataSource({ ...database.options });
    await secondDatabase.initialize();
    secondApp = await createApp(secondDatabase);
    delivery = app.get(AuthChallengeDeliveryService);
  }, 30_000);

  async function createApp(source: DataSource): Promise<INestApplication> {
    const module = await Test.createTestingModule({
      imports: [PassportModule.register({ defaultStrategy: 'jwt' })],
      controllers: [AuthController, BrowserSessionController],
      providers: [
        AuthService,
        BrowserSessionConfig,
        BrowserSessionCookieService,
        BrowserSessionGuard,
        BrowserSessionTransportService,
        UserService,
        AccountAccessPolicyService,
        AuthAbuseGuard,
        AuthChallengeService,
        AuthRateLimitService,
        AuthChallengeDeliveryService,
        SecureAuthChallengeFlowsService,
        AuthSecurityAuditService,
        RefreshSessionService,
        PasswordCredentialsService,
        AccountProvisioningService,
        RegistrationService,
        { provide: OAuthService, useValue: { complete: jest.fn() } },
        { provide: DataSource, useValue: source },
        { provide: ConfigService, useValue: config },
        {
          provide: getRepositoryToken(User),
          useValue: source.getRepository(User),
        },
        {
          provide: getRepositoryToken(AuthSession),
          useValue: source.getRepository(AuthSession),
        },
        {
          provide: JwtService,
          useValue: new JwtService(),
        },
        { provide: EmailService, useValue: { sendMail: mail } },
        JwtStrategy,
        JwtAuthGuard,
        { provide: APP_GUARD, useClass: JwtAuthGuard },
        { provide: APP_FILTER, useClass: GlobalExceptionFilter },
        { provide: APP_INTERCEPTOR, useClass: TransformInterceptor },
        {
          provide: WINSTON_MODULE_NEST_PROVIDER,
          useValue: {
            error: jest.fn(),
            warn: jest.fn(),
          },
        },
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

    const instance = module.createNestApplication();
    instance.enableCors({
      origin: ['https://app.ohealth.example'],
      credentials: true,
    });
    instance.setGlobalPrefix('api');
    instance.useGlobalPipes(
      new AuthChallengeValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await instance.init();
    return instance;
  }

  afterAll(async () => {
    await secondApp?.close();
    await app?.close();
    if (secondDatabase?.isInitialized) await secondDatabase.destroy();
    if (database?.isInitialized) await database.destroy();
    if (admin?.isInitialized) {
      await admin.query('DROP SCHEMA IF EXISTS "' + schema + '" CASCADE');
      await admin.destroy();
    }
  });

  beforeEach(async () => {
    mail.mockReset().mockResolvedValue(undefined);
    await database.query(
      'TRUNCATE registration_attempts, auth_challenge_deliveries, ' +
        'auth_challenges, auth_rate_limit_buckets',
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
    password = 'unused-password-hash',
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
        password,
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

  async function waitForLockWaiters(expected: number): Promise<void> {
    const deadline = performance.now() + 5_000;
    while (performance.now() < deadline) {
      const rows: Array<{ count: number }> = await admin.query(
        `SELECT count(*)::int AS count
         FROM pg_stat_activity
         WHERE application_name = $1
           AND wait_event_type = 'Lock'`,
        [applicationName],
      );
      if (rows[0].count >= expected) return;
      await new Promise((resolve) => {
        setTimeout(resolve, 20);
      });
    }
    throw new Error(`Timed out waiting for ${expected} database lock waiters.`);
  }

  it('requires a purpose-bound login code and creates one session under concurrent verification', async () => {
    const password = 'a memorable login passphrase';
    const user = await createUser(
      'login-code',
      'active',
      await bcrypt.hash(password, 10),
    );

    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: user.email, password })
      .expect(200);
    expect(login.body.data.challenge_id).toMatch(/^[a-f0-9-]{36}$/i);
    expect(login.body.data).not.toHaveProperty('access_token');
    expect(login.body.data).not.toHaveProperty('refresh_token');
    expect(login.body.data).not.toHaveProperty('session_id');

    expect(await delivery.dispatchBatch(1)).toMatchObject({ accepted: 1 });
    const mailed = mail.mock.calls[0][0] as {
      templateNameID: string;
      templateData: { code: string; challenge_id: string };
    };
    expect(mailed.templateNameID).toBe('login-code.njk');
    expect(mailed.templateData.challenge_id).toBe(login.body.data.challenge_id);

    await request(app.getHttpServer())
      .post('/api/auth/verify')
      .send({
        challenge_id: login.body.data.challenge_id,
        code: mailed.templateData.code,
      })
      .expect(400);

    const replies = await Promise.all(
      [app, secondApp].map((instance) =>
        request(instance.getHttpServer()).post('/api/auth/login/verify').send({
          challenge_id: login.body.data.challenge_id,
          code: mailed.templateData.code,
        }),
      ),
    );
    expect(replies.map((reply) => reply.status).sort()).toEqual([200, 400]);
    const success = replies.find((reply) => reply.status === 200)!;
    expect(success.body.data).toMatchObject({
      access_token: expect.any(String),
      refresh_token: expect.stringMatching(/^[A-Za-z0-9_-]{43}$/),
      session_id: expect.stringMatching(/^[a-f0-9-]{36}$/i),
    });
    await request(app.getHttpServer())
      .post('/api/auth/login/verify')
      .send({
        challenge_id: login.body.data.challenge_id,
        code: mailed.templateData.code,
      })
      .expect(400);

    await database.query(
      "UPDATE auth_challenges SET issued_at = now() - interval '61 seconds' " +
        'WHERE id = $1',
      [login.body.data.challenge_id],
    );
    await request(app.getHttpServer())
      .post('/api/auth/login/resend')
      .send({ challenge_id: login.body.data.challenge_id })
      .expect(400);
    const postLoginChallenges: Array<{ count: number }> = await database.query(
      'SELECT count(*)::int AS count FROM auth_challenges ' +
        'WHERE subject_user_id = $1 AND purpose = $2',
      [user.id, AuthChallengePurpose.LOGIN_VERIFICATION],
    );
    expect(postLoginChallenges[0].count).toBe(1);

    const sessions: Array<{ count: number }> = await database.query(
      'SELECT count(*)::int AS count FROM auth_sessions WHERE user_id = $1',
      [user.id],
    );
    expect(sessions[0].count).toBe(1);
    const events: Array<{ event_type: string }> = await database.query(
      'SELECT event_type FROM auth_security_events WHERE subject_user_id = $1',
      [user.id],
    );
    expect(events.map((event) => event.event_type)).toEqual(
      expect.arrayContaining([
        'login_challenge_request',
        'login_challenge_delivery',
        'login_challenge_verification',
        'sign_in',
      ]),
    );
  }, 30_000);

  it('resends through the opaque challenge id and supersedes the prior login code', async () => {
    const password = 'another memorable login passphrase';
    const user = await createUser(
      'login-resend',
      'active',
      await bcrypt.hash(password, 10),
    );
    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: user.email, password })
      .expect(200);

    const cooldown = await request(app.getHttpServer())
      .post('/api/auth/login/resend')
      .send({ challenge_id: login.body.data.challenge_id })
      .expect(429);
    expect(cooldown.body.error_code).toBe('AUTH_CHALLENGE_COOLDOWN');
    expect(cooldown.headers['retry-after']).toBeDefined();

    await database.query(
      "UPDATE auth_challenges SET issued_at = now() - interval '61 seconds' " +
        'WHERE id = $1',
      [login.body.data.challenge_id],
    );
    const resent = await request(secondApp.getHttpServer())
      .post('/api/auth/login/resend')
      .send({ challenge_id: login.body.data.challenge_id })
      .expect(200);
    expect(resent.body.data.challenge_id).not.toBe(
      login.body.data.challenge_id,
    );

    const rows: Array<{ id: string; consumed_at: Date | null }> =
      await database.query(
        'SELECT id, consumed_at FROM auth_challenges ' +
          'WHERE subject_user_id = $1 AND purpose = $2 ORDER BY issued_at',
        [user.id, AuthChallengePurpose.LOGIN_VERIFICATION],
      );
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      id: login.body.data.challenge_id,
      consumed_at: expect.any(Date),
    });
    expect(rows[1]).toMatchObject({ id: resent.body.data.challenge_id });
    expect(rows[1].consumed_at).toBeNull();

    const unknownId = randomUUID();
    const unknown = await request(app.getHttpServer())
      .post('/api/auth/login/resend')
      .send({ challenge_id: unknownId })
      .expect(400);
    expect(unknown.body).toMatchObject({
      error_code: 'AUTH_CHALLENGE_INVALID',
    });
  }, 30_000);

  it('revalidates account state before consuming login proof or issuing a session', async () => {
    const user = await createUser('login-state-change', 'active');
    const challenge = await app
      .get(AuthChallengeService)
      .issueForUser(user.id, AuthChallengePurpose.LOGIN_VERIFICATION);
    await database.query(
      "UPDATE users SET account_status = 'suspended' WHERE id = $1",
      [user.id],
    );

    await request(app.getHttpServer())
      .post('/api/auth/login/verify')
      .send({ challenge_id: challenge.challengeId, code: challenge.code })
      .expect(401);

    const challenges: Array<{ consumed_at: Date | null }> =
      await database.query(
        'SELECT consumed_at FROM auth_challenges WHERE id = $1',
        [challenge.challengeId],
      );
    expect(challenges[0].consumed_at).toBeNull();
    const sessions: Array<{ count: number }> = await database.query(
      'SELECT count(*)::int AS count FROM auth_sessions WHERE user_id = $1',
      [user.id],
    );
    expect(sessions[0].count).toBe(0);
    const events: Array<{ event_type: string; outcome: string }> =
      await database.query(
        'SELECT event_type, outcome FROM auth_security_events ' +
          'WHERE subject_user_id = $1',
        [user.id],
      );
    expect(events).toContainEqual({
      event_type: 'login_challenge_verification',
      outcome: 'denied',
    });
  });

  it('binds contact resend to the opaque challenge and rejects email-only targets', async () => {
    const pending = await createUser('pending-resend', 'pending_verification');
    const challenge = await app
      .get(AuthChallengeService)
      .issueForUser(pending.id, AuthChallengePurpose.CONTACT_VERIFICATION);
    await database.query(
      "UPDATE auth_challenges SET issued_at = now() - interval '61 seconds' WHERE id = $1",
      [challenge.challengeId],
    );
    const response = await request(app.getHttpServer())
      .post('/api/auth/verify/resend')
      .send({ challenge_id: challenge.challengeId })
      .expect(200);
    expect(response.body.data.challenge_id).not.toBe(challenge.challengeId);
    await request(app.getHttpServer())
      .post('/api/auth/verify/resend')
      .send({ email: pending.email })
      .expect(400);
  }, 15_000);

  it('rotates over HTTP, lists safe metadata and enforces logout on access and refresh', async () => {
    const user = await createUser('session-http', 'active');
    const issued = await app.get(RefreshSessionService).issue(user.id);
    const listed = await request(app.getHttpServer())
      .get('/api/auth/sessions')
      .set('Authorization', `Bearer ${issued.access_token}`)
      .expect(200);
    expect(listed.body.data).toHaveLength(1);
    expect(Object.keys(listed.body.data[0]).sort()).toEqual(
      ['session_id', 'created_at', 'last_used_at', 'expires_at'].sort(),
    );
    const rotated = await request(secondApp.getHttpServer())
      .post('/api/auth/refresh')
      .send({ refresh_token: issued.refresh_token })
      .expect(200);
    expect(rotated.body.data.session_id).toBe(issued.session_id);
    await request(app.getHttpServer())
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${rotated.body.data.access_token}`)
      .send({ session_id: issued.session_id })
      .expect(200);
    await request(secondApp.getHttpServer())
      .get('/api/auth/sessions')
      .set('Authorization', `Bearer ${issued.access_token}`)
      .expect(401);
    await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .send({ refresh_token: rotated.body.data.refresh_token })
      .expect(401);
  });

  it('uses browser cookies over the canonical PostgreSQL session authority', async () => {
    const user = await createUser('browser-session-http', 'active');
    const sessions = app.get(RefreshSessionService);
    const issued = await sessions.issue(user.id);
    const browserHeaders = {
      Origin: 'https://app.ohealth.example',
      ['X-OHealth-Client']: 'browser',
    };

    const refreshed = await request(app.getHttpServer())
      .post('/api/auth/browser/refresh')
      .set(browserHeaders)
      .set('Cookie', `__Host-ohealth_refresh=${issued.refresh_token}`)
      .expect(200);
    expect(refreshed.body.data).toMatchObject({
      access_token: expect.any(String),
      session_id: issued.session_id,
    });
    expect(refreshed.body.data).not.toHaveProperty('refresh_token');
    const rotatedCookie = refreshed.headers['set-cookie']?.[0];
    expect(rotatedCookie).toContain('__Host-ohealth_refresh=');
    expect(rotatedCookie).toContain('HttpOnly');
    expect(rotatedCookie).toContain('Secure');
    expect(rotatedCookie).toContain('SameSite=Strict');

    const replay = await request(secondApp.getHttpServer())
      .post('/api/auth/browser/refresh')
      .set(browserHeaders)
      .set('Cookie', `__Host-ohealth_refresh=${issued.refresh_token}`)
      .expect(401);
    expect(replay.headers['set-cookie']?.[0]).toContain(
      '__Host-ohealth_refresh=;',
    );
    const replayedSession = await database
      .getRepository(AuthSession)
      .findOneByOrFail({ session_id: issued.session_id });
    expect(replayedSession.revoked_at).toBeInstanceOf(Date);

    const logoutSession = await sessions.issue(user.id);
    const logout = await request(app.getHttpServer())
      .post('/api/auth/browser/logout')
      .set(browserHeaders)
      .set('Cookie', `__Host-ohealth_refresh=${logoutSession.refresh_token}`)
      .expect(200);
    expect(logout.headers['set-cookie']?.[0]).toContain(
      '__Host-ohealth_refresh=;',
    );
    const loggedOut = await database
      .getRepository(AuthSession)
      .findOneByOrFail({ session_id: logoutSession.session_id });
    expect(loggedOut.revoked_at).toBeInstanceOf(Date);

    const mobileSession = await sessions.issue(user.id);
    const mobileRefresh = await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .set('Cookie', `__Host-ohealth_refresh=${'x'.repeat(43)}`)
      .send({ refresh_token: mobileSession.refresh_token })
      .expect(200);
    expect(mobileRefresh.body.data.refresh_token).toMatch(
      /^[A-Za-z0-9_-]{43}$/,
    );

    const events: Array<{ event_type: string; session_id: string }> =
      await database.query(
        'SELECT event_type, session_id FROM auth_security_events ' +
          'WHERE session_id = ANY($1::uuid[])',
        [[issued.session_id, logoutSession.session_id]],
      );
    expect(events).toEqual(
      expect.arrayContaining([
        {
          event_type: 'session_reuse',
          session_id: issued.session_id,
        },
        { event_type: 'logout', session_id: logoutSession.session_id },
      ]),
    );
  });

  it('revokes canonical access and refresh credentials after recovery races rotation', async () => {
    const user = await createUser('reset-session-race', 'active');
    const issued = await app.get(RefreshSessionService).issue(user.id);
    const pendingLogin = await app
      .get(AuthChallengeService)
      .issueForUser(user.id, AuthChallengePurpose.LOGIN_VERIFICATION);
    const challenge = await app
      .get(AuthChallengeService)
      .issueForUser(user.id, AuthChallengePurpose.PASSWORD_RECOVERY);
    const [reset, refresh] = await Promise.all([
      request(app.getHttpServer()).post('/api/auth/reset-password').send({
        challenge_id: challenge.challengeId,
        code: challenge.code,
        newPassword: 'a memorable replacement passphrase',
      }),
      request(secondApp.getHttpServer())
        .post('/api/auth/refresh')
        .send({ refresh_token: issued.refresh_token }),
    ]);
    expect(reset.status).toBe(201);
    expect([200, 401]).toContain(refresh.status);
    for (const accessToken of [
      issued.access_token,
      refresh.body.data?.access_token,
    ].filter(Boolean)) {
      await request(app.getHttpServer())
        .get('/api/auth/sessions')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(401);
    }
    for (const refreshToken of [
      issued.refresh_token,
      refresh.body.data?.refresh_token,
    ].filter(Boolean)) {
      await request(secondApp.getHttpServer())
        .post('/api/auth/refresh')
        .send({ refresh_token: refreshToken })
        .expect(401);
    }
    await request(app.getHttpServer())
      .post('/api/auth/login/verify')
      .send({
        challenge_id: pendingLogin.challengeId,
        code: pendingLogin.code,
      })
      .expect(400);
  });

  it('uses the real guard and PostgreSQL counter for concurrent distributed budgets', async () => {
    const instances = Array.from({ length: 9 }, (_, i) =>
      request((i % 2 ? app : secondApp).getHttpServer())
        .post('/api/auth/verify/resend')
        .send({ email: 'unknown+' + randomUUID() + '@example.test' }),
    );
    const responses = await Promise.all(instances);
    expect(
      responses.filter((response) => response.status === 400),
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
      .expect(503);
    const known = await request(app.getHttpServer())
      .post('/api/auth/forgot-password')
      .send({ email: active.email })
      .expect(503);
    expect(known.body.error_code).toBe('AUTH_SERVICE_TEMPORARILY_UNAVAILABLE');
    expect(known.body.error_code).toBe(unknown.body.error_code);
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
      .expect(202);
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
        password: 'a memorable patient passphrase',
        intent: 'patient',
        accepted_terms_version: 'terms-v1',
        accepted_privacy_version: 'privacy-v1',
      })
      .expect(201);
    const challengeId = registered.body.data.challenge_id as string;
    expect(challengeId).toMatch(/^[a-f0-9-]{36}$/i);
    const before: Array<{
      account_status: string;
      verification_code: string | null;
      verification_code_expires_at: Date | null;
      reset_token: string | null;
      reset_token_expiry: Date | null;
    }> = await database.query(
      'SELECT account_status, verification_code, verification_code_expires_at, reset_token, reset_token_expiry FROM users WHERE email = $1',
      [email],
    );
    expect(before).toEqual([
      {
        account_status: 'pending_verification',
        verification_code: null,
        verification_code_expires_at: null,
        reset_token: null,
        reset_token_expiry: null,
      },
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
    expect(history).toHaveLength(2);
    expect(history).toEqual(
      expect.arrayContaining([
        { reason: 'password_registration' },
        { reason: 'verified_contact_challenge' },
      ]),
    );
  }, 20_000);

  it.each(['healthcare_professional', 'pharmacy', 'laboratory', 'hospital'])(
    'persists canonical %s onboarding state and legal evidence',
    async (intent) => {
      const suffix = randomUUID();
      const email = `${intent}+${suffix}@example.test`;
      const organization =
        intent === 'healthcare_professional'
          ? undefined
          : {
              name: `OHealth ${intent}`,
              registration_number: `RC-${suffix}`,
              location: 'Lagos',
              contact_email: `contact+${suffix}@example.test`,
            };
      await request(app.getHttpServer())
        .post('/api/auth/signup')
        .send({
          first_name: 'Ada',
          last_name: 'Owner',
          email,
          password: 'a memorable registration passphrase',
          intent,
          accepted_terms_version: 'terms-v1',
          accepted_privacy_version: 'privacy-v1',
          ...(organization ? { organization } : {}),
        })
        .expect(201);
      const rows: Array<{
        role: string;
        persona_type: string | null;
        organization_type: string | null;
        membership_role: string | null;
        legal_count: number;
      }> = await database.query(
        `SELECT u.role, p.persona_type, o.organization_type,
                m.role AS membership_role,
                (SELECT count(*)::int FROM legal_acceptances l WHERE l.user_id = u.id) AS legal_count
         FROM users u
         LEFT JOIN user_personas p ON p.user_id = u.id
         LEFT JOIN organization_memberships m ON m.user_id = u.id
         LEFT JOIN organizations o ON o.id = m.organization_id
         WHERE u.email = $1`,
        [email],
      );
      expect(rows).toHaveLength(1);
      expect(rows[0].role).toBe('');
      expect(rows[0].legal_count).toBe(2);
      const expectedContext =
        intent === 'healthcare_professional'
          ? {
              persona_type: 'healthcare_professional',
              organization_type: null,
              membership_role: null,
            }
          : {
              persona_type: null,
              organization_type: intent,
              membership_role: 'owner',
            };
      expect(rows[0]).toMatchObject(expectedContext);
    },
    20_000,
  );

  it('serializes concurrent duplicate and idempotent registration attempts', async () => {
    const suffix = randomUUID();
    const payload = {
      first_name: 'Ada',
      last_name: 'Retry',
      email: `retry+${suffix}@example.test`,
      password: 'a memorable registration passphrase',
      intent: 'patient',
      accepted_terms_version: 'terms-v1',
      accepted_privacy_version: 'privacy-v1',
    };
    const duplicate = await Promise.all(
      [app, secondApp].map((instance) =>
        request(instance.getHttpServer())
          .post('/api/auth/signup')
          .send(payload),
      ),
    );
    expect(duplicate.map((reply) => reply.status).sort()).toEqual([201, 409]);
    const secondPayload = {
      ...payload,
      email: `idempotent+${suffix}@example.test`,
    };
    const key = randomUUID();
    const retries = await Promise.all(
      [app, secondApp].map((instance) =>
        request(instance.getHttpServer())
          .post('/api/auth/signup')
          .set('Idempotency-Key', key)
          .send(secondPayload),
      ),
    );
    expect(retries.map((reply) => reply.status)).toEqual([201, 201]);
    expect(retries[0].body.data.challenge_id).toBe(
      retries[1].body.data.challenge_id,
    );
  }, 30_000);

  it('fails a registration replay that races behind contact verification', async () => {
    const suffix = randomUUID();
    const email = `verify-replay+${suffix}@example.test`;
    const key = randomUUID();
    const payload = {
      first_name: 'Ada',
      last_name: 'Replay',
      email,
      password: 'a memorable registration passphrase',
      intent: 'patient',
      accepted_terms_version: 'terms-v1',
      accepted_privacy_version: 'privacy-v1',
    };
    const registered = await request(app.getHttpServer())
      .post('/api/auth/signup')
      .set('Idempotency-Key', key)
      .send(payload)
      .expect(201);
    expect(await delivery.dispatchBatch(1)).toMatchObject({ accepted: 1 });
    const mailed = mail.mock.calls[0][0] as {
      templateData: { code: string };
    };
    const users: Array<{ id: string }> = await database.query(
      'SELECT id FROM users WHERE email = $1',
      [email],
    );
    const blocker = database.createQueryRunner();
    await blocker.connect();
    await blocker.startTransaction();
    try {
      await blocker.query('SELECT id FROM users WHERE id = $1 FOR UPDATE', [
        users[0].id,
      ]);
      const verification = request(secondApp.getHttpServer())
        .post('/api/auth/verify')
        .send({
          challenge_id: registered.body.data.challenge_id,
          code: mailed.templateData.code,
        })
        .then((reply) => reply);
      await waitForLockWaiters(1);
      const replay = request(app.getHttpServer())
        .post('/api/auth/signup')
        .set('Idempotency-Key', key)
        .send(payload)
        .then((reply) => reply);
      await waitForLockWaiters(2);
      await blocker.commitTransaction();
      const [verified, retried] = await Promise.all([verification, replay]);
      expect(verified.status).toBe(200);
      expect(retried.status).toBe(409);
    } finally {
      if (blocker.isTransactionActive) await blocker.rollbackTransaction();
      await blocker.release();
    }
  }, 30_000);

  it('returns the replacement challenge when replay races behind resend', async () => {
    const suffix = randomUUID();
    const email = `resend-replay+${suffix}@example.test`;
    const key = randomUUID();
    const payload = {
      first_name: 'Ada',
      last_name: 'Replay',
      email,
      password: 'a memorable registration passphrase',
      intent: 'patient',
      accepted_terms_version: 'terms-v1',
      accepted_privacy_version: 'privacy-v1',
    };
    const registered = await request(app.getHttpServer())
      .post('/api/auth/signup')
      .set('Idempotency-Key', key)
      .send(payload)
      .expect(201);
    await database.query(
      `UPDATE auth_challenges
       SET issued_at = now() - interval '61 seconds'
       WHERE id = $1`,
      [registered.body.data.challenge_id],
    );
    const users: Array<{ id: string }> = await database.query(
      'SELECT id FROM users WHERE email = $1',
      [email],
    );
    const blocker = database.createQueryRunner();
    await blocker.connect();
    await blocker.startTransaction();
    try {
      await blocker.query('SELECT id FROM users WHERE id = $1 FOR UPDATE', [
        users[0].id,
      ]);
      const resend = request(secondApp.getHttpServer())
        .post('/api/auth/verify/resend')
        .send({ challenge_id: registered.body.data.challenge_id })
        .then((reply) => reply);
      await waitForLockWaiters(1);
      const replay = request(app.getHttpServer())
        .post('/api/auth/signup')
        .set('Idempotency-Key', key)
        .send(payload)
        .then((reply) => reply);
      await waitForLockWaiters(2);
      await blocker.commitTransaction();
      const [resent, retried] = await Promise.all([resend, replay]);
      expect(resent.status).toBe(200);
      expect(retried.status).toBe(201);
      const current: Array<{ id: string }> = await database.query(
        `SELECT id FROM auth_challenges
         WHERE subject_user_id = $1 AND consumed_at IS NULL
         ORDER BY issued_at DESC LIMIT 1`,
        [users[0].id],
      );
      expect(current[0].id).not.toBe(registered.body.data.challenge_id);
      expect(retried.body.data.challenge_id).toBe(current[0].id);
    } finally {
      if (blocker.isTransactionActive) await blocker.rollbackTransaction();
      await blocker.release();
    }
  }, 30_000);

  it('rolls back identity and legal records when durable delivery cannot queue', async () => {
    const email = `rollback+${randomUUID()}@example.test`;
    const queue = jest
      .spyOn(delivery, 'queueInTransaction')
      .mockRejectedValueOnce(new Error('injected queue failure'));
    await request(app.getHttpServer())
      .post('/api/auth/signup')
      .send({
        first_name: 'Ada',
        last_name: 'Rollback',
        email,
        password: 'a memorable registration passphrase',
        intent: 'patient',
        accepted_terms_version: 'terms-v1',
        accepted_privacy_version: 'privacy-v1',
      })
      .expect(503);
    queue.mockRestore();
    const rows: Array<{ count: number }> = await database.query(
      'SELECT count(*)::int AS count FROM users WHERE email = $1',
      [email],
    );
    expect(rows[0].count).toBe(0);
  }, 20_000);

  it('rejects recovery proof used for contact verification without consuming it', async () => {
    const user = await createUser('purpose-isolation', 'active');
    await request(app.getHttpServer())
      .post('/api/auth/forgot-password')
      .send({ email: user.email })
      .expect(202);
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
    const initial = await app
      .get(AuthChallengeService)
      .issueForUser(user.id, AuthChallengePurpose.CONTACT_VERIFICATION);
    await database.query(
      "UPDATE auth_challenges SET issued_at = now() - interval '61 seconds' WHERE id = $1",
      [initial.challengeId],
    );
    const replies = await Promise.all(
      [app, secondApp].map((instance) =>
        request(instance.getHttpServer())
          .post('/api/auth/verify/resend')
          .send({ challenge_id: initial.challengeId }),
      ),
    );
    expect(replies.map((reply) => reply.status)).toEqual([200, 200]);
    expect(replies[0].body.data.challenge_id).toBe(
      replies[1].body.data.challenge_id,
    );
    const rows: Array<{ id: string; consumed_at: Date | null }> =
      await database.query(
        'SELECT id, consumed_at FROM auth_challenges WHERE subject_user_id = $1',
        [user.id],
      );
    expect(rows).toHaveLength(2);
    expect(rows.filter((row) => row.consumed_at === null)).toHaveLength(1);
    expect(
      rows.find((row) => row.id === initial.challengeId)?.consumed_at,
    ).toBeTruthy();
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
  it('allows only one verification across independent HTTP applications', async () => {
    const user = await createUser('verify-race', 'pending_verification');
    const challenge = await app
      .get(AuthChallengeService)
      .issueForUser(user.id, AuthChallengePurpose.CONTACT_VERIFICATION);
    const replies = await Promise.all(
      [app, secondApp].map((instance) =>
        request(instance.getHttpServer()).post('/api/auth/verify').send({
          challenge_id: challenge.challengeId,
          code: challenge.code,
        }),
      ),
    );
    expect(replies.map((reply) => reply.status).sort()).toEqual([200, 400]);
    const sessions = await database.query(
      'SELECT id FROM auth_sessions WHERE user_id = $1',
      [user.id],
    );
    expect(sessions).toHaveLength(1);
  });

  it('rejects contact proof at recovery, expiry, and the correct code after five wrong attempts', async () => {
    const user = await createUser('attempt-boundary', 'pending_verification');
    const challenge = await app
      .get(AuthChallengeService)
      .issueForUser(user.id, AuthChallengePurpose.CONTACT_VERIFICATION);
    await request(app.getHttpServer())
      .post('/api/auth/reset-password')
      .send({
        challenge_id: challenge.challengeId,
        code: challenge.code,
        newPassword: 'a memorable replacement passphrase',
      })
      .expect(400);
    const wrong = challenge.code === '000000' ? '000001' : '000000';
    for (let i = 0; i < 5; i++) {
      await request((i % 2 ? app : secondApp).getHttpServer())
        .post('/api/auth/verify')
        .send({ challenge_id: challenge.challengeId, code: wrong })
        .expect(400);
    }
    await request(app.getHttpServer())
      .post('/api/auth/verify')
      .send({ challenge_id: challenge.challengeId, code: challenge.code })
      .expect(400);
    const rows = await database.query(
      'SELECT attempt_count, consumed_at FROM auth_challenges WHERE id = $1',
      [challenge.challengeId],
    );
    expect(rows[0].attempt_count).toBe(5);
    expect(rows[0].consumed_at).toBeTruthy();
    const expiredUser = await createUser(
      'expired-contact',
      'pending_verification',
    );
    const expired = await app
      .get(AuthChallengeService)
      .issueForUser(expiredUser.id, AuthChallengePurpose.CONTACT_VERIFICATION);
    await database.query(
      "UPDATE auth_challenges SET issued_at = now() - interval '11 minutes', expires_at = now() - interval '1 second' WHERE id = $1",
      [expired.challengeId],
    );
    await request(app.getHttpServer())
      .post('/api/auth/verify')
      .send({ challenge_id: expired.challengeId, code: expired.code })
      .expect(400);
    const saved = await database.query(
      'SELECT account_status FROM users WHERE id = $1',
      [expiredUser.id],
    );
    expect(saved[0].account_status).toBe('pending_verification');
  });

  it('recovers a provider timeout without claiming acceptance and wipes the envelope on recovery', async () => {
    const user = await createUser('provider-retry', 'active');
    await request(app.getHttpServer())
      .post('/api/auth/forgot-password')
      .send({ email: user.email })
      .expect(202);
    // Exercise the real 30-second provider timeout without faking clocks or
    // replacing delivery/persistence services.
    mail.mockImplementationOnce(() => new Promise<void>(() => {}));
    expect(await delivery.dispatchBatch(1)).toEqual({
      accepted: 0,
      retried: 1,
      discarded: 0,
    });
    let rows = await database.query(
      'SELECT status, ciphertext, attempts FROM auth_challenge_deliveries',
    );
    expect(rows[0]).toMatchObject({ status: 'pending', attempts: 1 });
    expect(rows[0].ciphertext).toBeTruthy();
    await database.query(
      "UPDATE auth_challenge_deliveries SET available_at = now() - interval '1 second'",
    );
    expect(
      await secondApp.get(AuthChallengeDeliveryService).dispatchBatch(1),
    ).toEqual({ accepted: 1, retried: 0, discarded: 0 });
    rows = await database.query(
      'SELECT status, ciphertext, attempts FROM auth_challenge_deliveries',
    );
    expect(rows[0]).toEqual({
      status: 'accepted',
      ciphertext: null,
      attempts: 2,
    });
  }, 40_000);

  it('measures recovery response timing across unknown, pending, active, suspended, deactivated and cooldown targets', async () => {
    const users = await Promise.all([
      createUser('timing-pending', 'pending_verification'),
      createUser('timing-active', 'active'),
      createUser('timing-suspended', 'suspended'),
      createUser('timing-deactivated', 'deactivated'),
      createUser('timing-cooldown', 'active'),
    ]);
    const targets = [
      'absent+' + randomUUID() + '@example.test',
      ...users.map((user) => user.email),
    ];
    const samples: number[][] = targets.map(() => []);
    const cooldownId = users[4].id;
    for (let round = 0; round < 12; round++) {
      // Rotate order to avoid warming/ordering bias. Reset budgets only so the
      // timing experiment measures eligibility rather than deliberate 429s.
      for (let offset = 0; offset < targets.length; offset++) {
        const index = (round + offset) % targets.length;
        await database.query('TRUNCATE auth_rate_limit_buckets');
        // Re-arm the eligible target each sample; cooldown remains untouched.
        if (index === 2)
          await database.query(
            'DELETE FROM auth_challenges WHERE subject_user_id = $1',
            [users[1].id],
          );
        await healthyWorker();
        const start = performance.now();
        const response = await request(
          (round % 2 ? app : secondApp).getHttpServer(),
        )
          .post('/api/auth/forgot-password')
          .send({ email: targets[index] })
          .expect(202);
        samples[index].push(performance.now() - start);
        expect(response.body).toEqual({
          status_code: 202,
          message: publicMessage,
          data: null,
        });
      }
    }
    const medians = samples.map(
      (values) =>
        [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)],
    );
    // A bounded regression check, not proof against statistical enumeration.
    // The report is evidence for the 350–599 ms floor on this CI workload.
    // eslint-disable-next-line no-console -- safe aggregate timing evidence for CI
    console.info(
      'Recovery timing milliseconds (unknown,pending,eligible,suspended,deactivated,cooldown)',
      JSON.stringify(
        samples.map((values, index) => ({
          median: Math.round(medians[index]),
          max: Math.round(Math.max(...values)),
          min: Math.round(Math.min(...values)),
        })),
      ),
    );
    expect(Math.max(...medians) - Math.min(...medians)).toBeLessThan(200);
    expect(samples.flat().every((value) => value >= 340)).toBe(true);
    const issued = await database.query(
      'SELECT id FROM auth_challenges WHERE subject_user_id = $1',
      [cooldownId],
    );
    expect(issued).toHaveLength(1);
  }, 60_000);
});
