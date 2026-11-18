import { randomBytes, randomUUID } from 'node:crypto';
import { env } from 'node:process';

import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { DataSource } from 'typeorm';

import { AuthChallengeValidationPipe } from '../../modules/auth/challenges/auth-challenge-validation.pipe';
import { RefreshSessionService } from '../../modules/auth/sessions/refresh-session.service';

const integration = env.PG_INTEGRATION_URL ? describe : describe.skip;

/**
 * Settings the application module reads while it starts. Only values this
 * suite generates are used; nothing is read from a deployed environment.
 */
function applicationEnvironment(
  databaseUrl: string,
): ReadonlyArray<[name: string, value: string]> {
  return [
    ['NODE_ENV', 'test'],
    ['DATABASE_URL', databaseUrl],
    ['DB_SSL', 'false'],
    ['JWT_SECRET', randomBytes(32).toString('hex')],
    ['TOKEN_ACCESS_DURATION', '15m'],
    ['TOKEN_REFRESH_DURATION', '7d'],
    ['AUTH_CHALLENGE_PEPPER', randomBytes(32).toString('hex')],
    ['AUTH_CHALLENGE_DELIVERY_KEY', randomBytes(32).toString('base64')],
    ['AUTH_CHALLENGE_FLOWS_ENABLED', 'true'],
    ['AUTH_BROWSER_SESSION_ENABLED', 'false'],
    ['GOOGLE_OAUTH_ENABLED', 'false'],
    ['MFA_ENCRYPTION_KEY', randomBytes(32).toString('base64')],
    [
      'MFA_REQUIRED_CATEGORIES',
      'platform_admin,organization_owner,organization_admin',
    ],
    ['REGISTRATION_TERMS_VERSION', 'terms-v1'],
    ['REGISTRATION_PRIVACY_VERSION', 'privacy-v1'],
    ['REGISTRATION_IDEMPOTENCY_PEPPER', randomBytes(32).toString('hex')],
    [
      'AUTH_RECOVERY_CONTINUATION_URL',
      'https://app.example.com/reset-password',
    ],
    ['FRONTEND_URL', 'https://app.example.com'],
    ['MAIL_MAILER', 'smtp'],
    ['MAIL_HOST', '127.0.0.1'],
    ['MAIL_PORT', '1025'],
    ['MAIL_FROM_ADDRESS', 'no-reply@example.com'],
    ['MAIL_FROM_NAME', 'OHealth'],
  ];
}

// Boots the real application module, with its real module graph, on a
// database built by every migration. A capability guard used by a controller
// outside the auth module resolves its dependencies through that module's
// imports, so only the real graph shows whether the authorization audit
// reaches it.
integration('Capability guards across module boundaries', () => {
  const databaseName = 'capability_audit_' + randomUUID().replaceAll('-', '');
  const previous = new Map<string, string | undefined>();
  let admin: DataSource;
  let database: DataSource;
  let app: INestApplication;
  let patientId: string;
  let patientSessionId: string;
  let patientToken: string;
  let professionalId: string;
  let slotDate: string;

  const server = () => request(app.getHttpServer());

  const denials = (): Promise<Array<Record<string, unknown>>> =>
    database.query(
      `SELECT * FROM auth_security_events
       WHERE event_type = 'authorization_denial' ORDER BY occurred_at`,
    );

  beforeAll(async () => {
    admin = new DataSource({ type: 'postgres', url: env.PG_INTEGRATION_URL });
    await admin.initialize();
    await admin.query(`CREATE DATABASE "${databaseName}"`);
    const url = new URL(env.PG_INTEGRATION_URL as string);
    url.pathname = '/' + databaseName;

    database = new DataSource({
      type: 'postgres',
      url: url.toString(),
      migrations: [__dirname + '/../migrations/*.ts'],
      synchronize: false,
    });
    await database.initialize();
    await database.runMigrations();

    // A patient with an active, verified account, and a verified
    // professional with one open slot to book.
    [{ id: patientId }] = await database.query(
      `INSERT INTO users (email, password, first_name, last_name,
         account_status, is_active, is_verified, email_verified_at)
       VALUES ('patient@private.example.com', 'stored-password-hash', 'Ada',
         'Patient', 'active', true, true, now()) RETURNING id`,
    );
    await database.query(
      `INSERT INTO user_personas (user_id, persona_type) VALUES ($1, 'patient')`,
      [patientId],
    );
    const [{ id: ownerId }] = await database.query(
      `INSERT INTO users (email, password, first_name, last_name,
         account_status, is_active, is_verified, email_verified_at)
       VALUES ('professional@private.example.com', 'stored-password-hash',
         'Obi', 'Professional', 'active', true, true, now()) RETURNING id`,
    );
    const [{ id: specialityId }] = await database.query(
      `INSERT INTO specialities (name) VALUES ('Capability audit') RETURNING id`,
    );
    [{ id: professionalId }] = await database.query(
      `INSERT INTO professionals (user_id, speciality_id, consultation_fee,
         verification_status, is_active)
       VALUES ($1, $2, 3000, 'verified', true) RETURNING id`,
      [ownerId, specialityId],
    );
    slotDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
    await database.query(
      `INSERT INTO professional_availabilities
         (professional_id, date, start_time, end_time)
       VALUES ($1, $2, '09:00', '09:30')`,
      [professionalId, slotDate],
    );

    for (const [key, value] of applicationEnvironment(url.toString())) {
      previous.set(key, env[key]);
      env[key] = value;
    }
    // Loaded only now, because the module reads its settings as it loads.
    const { AppModule } = await import('../../app.module');
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new AuthChallengeValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();

    const session = await app.get(RefreshSessionService).issue(patientId);
    patientToken = session.access_token;
    patientSessionId = session.session_id;
  }, 120_000);

  afterAll(async () => {
    await app?.close();
    await database?.destroy();
    for (const [key, value] of previous) {
      if (value === undefined) delete env[key];
      else env[key] = value;
    }
    if (admin?.isInitialized) {
      await admin.query(`DROP DATABASE IF EXISTS "${databaseName}"`);
      await admin.destroy();
    }
  }, 60_000);

  it('lets a patient with patient.bookings reach the booking controller', async () => {
    const result = await server()
      .get('/api/bookings')
      .set('Authorization', `Bearer ${patientToken}`);

    expect({ status: result.status, message: result.body.message }).toEqual({
      status: 200,
      message: expect.not.stringContaining('authorization audit'),
    });

    expect(result.body).toMatchObject({ status_code: 200, data: [] });
    expect(result.text).not.toContain('authorization audit is unavailable');
  });

  it('lets that patient create a booking through the booking service', async () => {
    const result = await server()
      .post('/api/bookings')
      .set('Authorization', `Bearer ${patientToken}`)
      .send({
        professional_id: professionalId,
        booking_date: slotDate,
        booking_time: '09:00',
        consultation_type: 'video',
        notes: 'Private appointment note',
      })
      .expect(201);

    expect(result.body.data).toMatchObject({
      patient_id: patientId,
      professional_id: professionalId,
      status: 'pending',
    });
    const [{ total }] = await database.query(
      'SELECT COUNT(*)::int AS total FROM bookings WHERE patient_id = $1',
      [patientId],
    );
    expect(total).toBe(1);
  });

  it('still refuses a capability the patient lacks and records the denial', async () => {
    const before = (await denials()).length;

    const result = await server()
      .get('/api/professionals/me/dashboard')
      .set('Authorization', `Bearer ${patientToken}`)
      .send({ notes: 'Private request body' })
      .expect(403);

    expect(result.text).not.toContain('authorization audit is unavailable');
    const recorded = await denials();
    expect(recorded).toHaveLength(before + 1);
    const denial = recorded[recorded.length - 1];
    expect(denial).toMatchObject({
      event_type: 'authorization_denial',
      outcome: 'denied',
      actor_user_id: patientId,
      subject_user_id: patientId,
    });
    expect(String(denial.session_id)).toBe(patientSessionId);
    const serialized = JSON.stringify(denial);
    [
      patientToken,
      'Bearer',
      'Private request body',
      'Private appointment note',
      'patient@private.example.com',
      'stored-password-hash',
    ].forEach((value) => expect(serialized).not.toContain(value));
  });

  it('still refuses an anonymous request before any capability check', async () => {
    const before = (await denials()).length;

    await server().get('/api/bookings').expect(401);

    expect(await denials()).toHaveLength(before);
  });
});
