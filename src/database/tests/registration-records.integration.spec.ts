import { randomUUID } from 'node:crypto';
import { env } from 'node:process';

import { ConflictException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource, EntityManager, QueryRunner } from 'typeorm';

import { RegisterAccountDto } from '../../modules/auth/contracts/register-account.dto';
import { SignupIntent } from '../../modules/auth/enums/signup-intent.enum';
import { PasswordCredentialsService } from '../../modules/auth/password-policy/password-credentials.service';
import { RegistrationRecordsService } from '../../modules/auth/registration/registration-records.service';
import { RegistrationRetryMaintenanceService } from '../../modules/auth/registration/registration-retry-maintenance.service';
import { User } from '../../modules/user/entities/user.entity';
import { NormalizedSignupKeys1793150000000 } from '../migrations/1793150000000-NormalizedSignupKeys';
import { RegistrationIdempotency1793160000000 } from '../migrations/1793160000000-RegistrationIdempotency';
import { RegistrationRetryRetentionIndex1793165000000 } from '../migrations/1793165000000-RegistrationRetryRetentionIndex';

const integration = env.PG_INTEGRATION_URL ? describe : describe.skip;
const CHALLENGE_ID = 'f64031c5-70e4-4b37-a92c-f193e59a6621';

const patient: RegisterAccountDto = {
  first_name: 'Ada',
  last_name: 'Okafor',
  email: 'ADA@Example.test',
  password: 'a long unique test passphrase',
  intent: SignupIntent.PATIENT,
  accepted_terms_version: 'terms-v3',
  accepted_privacy_version: 'privacy-v4',
};

integration('Transactional intent registration on PostgreSQL', () => {
  let database: DataSource;
  let schema: string;
  let service: RegistrationRecordsService;
  let cleanup: RegistrationRetryMaintenanceService;

  async function inSchema<T>(
    operation: (runner: QueryRunner) => Promise<T>,
  ): Promise<T> {
    const runner = database.createQueryRunner();
    await runner.connect();
    try {
      await runner.startTransaction();
      await runner.query(`SET LOCAL search_path TO "${schema}", public`);
      const result = await operation(runner);
      await runner.commitTransaction();
      return result;
    } catch (error) {
      if (runner.isTransactionActive) await runner.rollbackTransaction();
      throw error;
    } finally {
      await runner.release();
    }
  }

  async function count(table: string): Promise<number> {
    const rows: Array<{ total: number }> = await inSchema((runner) =>
      runner.query(`SELECT count(*)::int AS total FROM "${schema}"."${table}"`),
    );
    return rows[0].total;
  }

  const writeChallenge = async (manager: EntityManager, user: User) => {
    await manager.query(
      'INSERT INTO durable_challenge_delivery (id, user_id) VALUES ($1, $2)',
      [CHALLENGE_ID, user.id],
    );
    return {
      challengeId: CHALLENGE_ID,
      resendAfterSeconds: 60,
      expiresInSeconds: 600,
    };
  };

  beforeAll(async () => {
    database = new DataSource({
      type: 'postgres',
      url: env.PG_INTEGRATION_URL,
      entities: [__dirname + '/../../modules/**/*.entity.ts'],
      synchronize: false,
    });
    await database.initialize();
    await database.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
  });

  beforeEach(async () => {
    schema = 'register_' + randomUUID().replaceAll('-', '');
    await database.query(`CREATE SCHEMA "${schema}"`);
    const setup = database.createQueryRunner();
    await setup.connect();
    try {
      await setup.query(`SET search_path TO "${schema}", public`);
      await setup.query(`
        CREATE TABLE users (
          id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
          created_at timestamptz NOT NULL DEFAULT now(),
          updated_at timestamptz NOT NULL DEFAULT now(),
          email varchar NOT NULL UNIQUE,
          first_name varchar NOT NULL,
          last_name varchar NOT NULL,
          middle_name varchar,
          gender varchar,
          dob date,
          phone varchar,
          country varchar,
          image varchar,
          password varchar NOT NULL,
          role text NOT NULL DEFAULT 'PATIENT',
          account_status varchar NOT NULL DEFAULT 'pending_verification',
          email_verified_at timestamptz,
          is_active boolean NOT NULL DEFAULT false,
          is_verified boolean NOT NULL DEFAULT false,
          verification_code varchar,
          verification_code_expires_at timestamptz,
          google_id varchar,
          reset_token varchar,
          reset_token_expiry timestamptz
        )
      `);
      await setup.query(`
        CREATE TABLE organizations (
          id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
          created_at timestamptz NOT NULL DEFAULT now(),
          updated_at timestamptz NOT NULL DEFAULT now(),
          organization_type varchar NOT NULL,
          name varchar NOT NULL,
          registration_number varchar NOT NULL UNIQUE,
          location text NOT NULL,
          contact_email varchar NOT NULL,
          contact_phone varchar,
          verification_status varchar NOT NULL DEFAULT 'pending',
          rejection_reason text,
          is_active boolean NOT NULL DEFAULT true
        )
      `);
      await setup.query(`
        CREATE TABLE user_personas (
          id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
          created_at timestamptz NOT NULL DEFAULT now(),
          updated_at timestamptz NOT NULL DEFAULT now(),
          user_id uuid NOT NULL REFERENCES users(id),
          persona_type varchar NOT NULL,
          is_active boolean NOT NULL DEFAULT true
        )
      `);
      await setup.query(`
        CREATE TABLE patient_profiles (
          id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
          created_at timestamptz NOT NULL DEFAULT now(),
          updated_at timestamptz NOT NULL DEFAULT now(),
          user_id uuid NOT NULL REFERENCES users(id) UNIQUE,
          address varchar(500),
          patient_reference varchar,
          medical_conditions text,
          allergies text,
          blood_group varchar,
          height_cm integer,
          weight_kg double precision,
          genotype varchar,
          emergency_contact_name varchar,
          emergency_contact_phone varchar
        )
      `);
      await setup.query(`
        CREATE TABLE organization_memberships (
          id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
          created_at timestamptz NOT NULL DEFAULT now(),
          updated_at timestamptz NOT NULL DEFAULT now(),
          organization_id uuid NOT NULL REFERENCES organizations(id),
          user_id uuid NOT NULL REFERENCES users(id),
          role varchar NOT NULL,
          status varchar NOT NULL DEFAULT 'active',
          permission_overrides jsonb NOT NULL DEFAULT '[]',
          invited_by_user_id uuid,
          joined_at timestamptz
        )
      `);
      await setup.query(`
        CREATE TABLE legal_acceptances (
          id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
          created_at timestamptz NOT NULL DEFAULT now(),
          updated_at timestamptz NOT NULL DEFAULT now(),
          user_id uuid NOT NULL REFERENCES users(id),
          document_type varchar NOT NULL,
          document_version varchar NOT NULL,
          accepted_at timestamptz NOT NULL,
          ip_address inet,
          user_agent text
        )
      `);
      await setup.query(`
        CREATE TABLE outbox_events (
          id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
          created_at timestamptz NOT NULL DEFAULT now(),
          updated_at timestamptz NOT NULL DEFAULT now(),
          aggregate_type varchar NOT NULL,
          aggregate_id uuid,
          event_type varchar NOT NULL,
          status varchar NOT NULL DEFAULT 'pending',
          payload jsonb NOT NULL DEFAULT '{}',
          attempts integer NOT NULL DEFAULT 0,
          available_at timestamptz NOT NULL DEFAULT now(),
          processed_at timestamptz,
          last_error text
        )
      `);
      await setup.query(`
        CREATE TABLE durable_challenge_delivery (
          id uuid PRIMARY KEY,
          user_id uuid NOT NULL REFERENCES users(id)
        )
      `);
      await new NormalizedSignupKeys1793150000000().up(setup);
      await new RegistrationIdempotency1793160000000().up(setup);
      await new RegistrationRetryRetentionIndex1793165000000().up(setup);
    } finally {
      await setup.release();
    }

    cleanup = new RegistrationRetryMaintenanceService({
      transaction: async <T>(
        callback: (manager: EntityManager) => Promise<T>,
      ) => inSchema((runner) => callback(runner.manager)),
    } as unknown as DataSource);

    service = new RegistrationRecordsService(
      {
        transaction: async <T>(
          callback: (manager: EntityManager) => Promise<T>,
        ) => inSchema((runner) => callback(runner.manager)),
      } as unknown as DataSource,
      {
        hashNewPassword: async () => 'test-password-hash',
      } as unknown as PasswordCredentialsService,
      {
        get: (key: string) =>
          key === 'REGISTRATION_TERMS_VERSION'
            ? 'terms-v3'
            : key === 'REGISTRATION_PRIVACY_VERSION'
              ? 'privacy-v4'
              : key === 'REGISTRATION_IDEMPOTENCY_PEPPER'
                ? 'a-random-32-plus-byte-server-held-signup-hmac-secret'
                : undefined,
      } as unknown as ConfigService,
    );
  });

  afterEach(async () => {
    if (schema) {
      await database.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    }
  });

  afterAll(async () => {
    if (database?.isInitialized) await database.destroy();
  });

  it('atomically creates pending patient, persona, profile, consent, and delivery request', async () => {
    const result = await service.registerPending(patient, writeChallenge);
    expect(result.challenge_id).toBe(CHALLENGE_ID);
    expect(result).not.toHaveProperty('access_token');
    expect(result).not.toHaveProperty('refresh_token');
    expect(await count('users')).toBe(1);
    expect(await count('user_personas')).toBe(1);
    expect(await count('patient_profiles')).toBe(1);
    expect(await count('legal_acceptances')).toBe(2);
    expect(await count('outbox_events')).toBe(1);
    expect(await count('durable_challenge_delivery')).toBe(1);
    const users: Array<{ account_status: string; is_active: boolean }> =
      await inSchema((runner) =>
        runner.query('SELECT account_status, is_active FROM users'),
      );
    expect(users[0]).toMatchObject({
      account_status: 'pending_verification',
      is_active: false,
    });
    const outbox: Array<{ payload: Record<string, unknown> }> = await inSchema(
      (runner) => runner.query('SELECT payload FROM outbox_events'),
    );
    expect(outbox[0].payload).toEqual({
      challenge_id: CHALLENGE_ID,
      purpose: 'contact_verification',
    });
  });

  it('rolls back all records if a challenge is written but delivery handoff fails', async () => {
    await expect(
      service.registerPending(patient, async (manager, user) => {
        await writeChallenge(manager, user);
        throw new Error('Delivery envelope could not be committed');
      }),
    ).rejects.toThrow('Delivery envelope could not be committed');
    for (const table of [
      'users',
      'user_personas',
      'patient_profiles',
      'legal_acceptances',
      'durable_challenge_delivery',
      'outbox_events',
    ]) {
      expect(await count(table)).toBe(0);
    }
  });

  it('returns controlled 409 for two concurrent attempts with the same normalized email', async () => {
    const outcomes = await Promise.allSettled([
      service.registerPending(patient, writeChallenge),
      service.registerPending(
        { ...patient, email: ' ada@example.test ' },
        writeChallenge,
      ),
    ]);
    const succeeded = outcomes.filter((item) => item.status === 'fulfilled');
    const rejected = outcomes.filter((item) => item.status === 'rejected');
    expect(succeeded).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    const errors = rejected.map((outcome) =>
      outcome.status === 'rejected' ? outcome.reason : null,
    );
    expect(errors).toEqual([expect.any(ConflictException)]);
    expect(await count('users')).toBe(1);
    expect(await count('legal_acceptances')).toBe(2);
    expect(await count('outbox_events')).toBe(1);
  });

  it('creates organization and owner membership only after the challenge writer succeeds', async () => {
    await service.registerPending(
      {
        ...patient,
        intent: SignupIntent.ORGANIZATION,
        organization: {
          organization_type: 'hospital' as never,
          name: 'Clinic',
          registration_number: 'RC-TEST-10',
          location: 'Abuja',
          contact_email: 'clinic@example.test',
        },
      },
      writeChallenge,
    );
    expect(await count('organizations')).toBe(1);
    expect(await count('organization_memberships')).toBe(1);
    expect(await count('patient_profiles')).toBe(0);
    const memberships: Array<{ role: string; status: string }> = await inSchema(
      (runner) =>
        runner.query('SELECT role, status FROM organization_memberships'),
    );
    expect(memberships[0]).toEqual({ role: 'owner', status: 'active' });
  });
  it('returns the same pending challenge for an identical request key without new writes', async () => {
    const key = randomUUID();
    const first = await service.registerPending(patient, writeChallenge, key);
    const second = await service.registerPending(
      { ...patient, email: ' ada@example.test ' },
      writeChallenge,
      key,
    );
    expect(second.challenge_id).toBe(first.challenge_id);
    expect(second.delivery_target).toBe(first.delivery_target);
    expect(second.expires_in_seconds).toBeLessThanOrEqual(
      first.expires_in_seconds,
    );
    expect(await count('users')).toBe(1);
    expect(await count('registration_attempts')).toBe(1);
    expect(await count('outbox_events')).toBe(1);
    expect(await count('durable_challenge_delivery')).toBe(1);
    const rows: Array<Record<string, unknown>> = await inSchema((runner) =>
      runner.query(
        'SELECT request_key_hash, request_fingerprint FROM registration_attempts',
      ),
    );
    const stored = JSON.stringify(rows);
    expect(stored).not.toContain(key);
    expect(stored).not.toContain(patient.password);
    expect(stored).not.toContain(patient.email);
  });

  it('serializes simultaneous duplicate requests with the same idempotency key', async () => {
    const key = randomUUID();
    const responses = await Promise.all([
      service.registerPending(patient, writeChallenge, key),
      service.registerPending(
        { ...patient, email: '  ada@example.test ' },
        writeChallenge,
        key,
      ),
    ]);
    expect(responses[0].challenge_id).toBe(responses[1].challenge_id);
    expect(await count('users')).toBe(1);
    expect(await count('registration_attempts')).toBe(1);
    expect(await count('outbox_events')).toBe(1);
    expect(await count('legal_acceptances')).toBe(2);
  });

  it('rejects conflicting payload reuse and expired challenge receipts without new writes', async () => {
    const key = randomUUID();
    await service.registerPending(patient, writeChallenge, key);
    await expect(
      service.registerPending(
        { ...patient, first_name: 'Someone else' },
        writeChallenge,
        key,
      ),
    ).rejects.toThrow(ConflictException);
    await inSchema((runner) =>
      runner.query(
        "UPDATE registration_attempts SET challenge_expires_at = now() - interval '1 second'",
      ),
    );
    await expect(
      service.registerPending(patient, writeChallenge, key),
    ).rejects.toThrow(ConflictException);
    expect(await count('users')).toBe(1);
    expect(await count('registration_attempts')).toBe(1);
    expect(await count('outbox_events')).toBe(1);
  });

  it('does not retain idempotency state if durable challenge delivery fails', async () => {
    await expect(
      service.registerPending(
        patient,
        async () => {
          throw new Error('Delivery envelope unavailable');
        },
        randomUUID(),
      ),
    ).rejects.toThrow('Delivery envelope unavailable');
    expect(await count('registration_attempts')).toBe(0);
    expect(await count('users')).toBe(0);
  });
  it('removes only overdue retry receipts in bounded batches, preserving account and durable evidence', async () => {
    const key = randomUUID();
    await service.registerPending(patient, writeChallenge, key);
    await inSchema((runner) =>
      runner.query(
        "UPDATE registration_attempts SET challenge_expires_at = now() - interval '26 hours'",
      ),
    );
    const [account]: Array<{ id: string }> = await inSchema((runner) =>
      runner.query('SELECT id FROM users LIMIT 1'),
    );
    await inSchema((runner) =>
      runner.query(
        `INSERT INTO registration_attempts
          (request_key_hash, request_fingerprint, user_id, challenge_id,
           challenge_expires_at, resend_after_at)
         VALUES
           ($1, $3, $5, $6, now() - interval '48 hours', now()),
           ($2, $3, $5, $6, now() - interval '25 hours', now()),
           ($4, $3, $5, $6, now() - interval '2 hours', now())`,
        [
          'a'.repeat(64),
          'b'.repeat(64),
          'f'.repeat(64),
          'c'.repeat(64),
          account.id,
          CHALLENGE_ID,
        ],
      ),
    );
    expect(await count('registration_attempts')).toBe(4);
    expect(await cleanup.pruneExpired(2)).toBe(2);
    expect(await cleanup.pruneExpired(2)).toBe(1);
    expect(await cleanup.pruneExpired(2)).toBe(0);
    expect(await count('registration_attempts')).toBe(1);
    expect(await count('users')).toBe(1);
    expect(await count('patient_profiles')).toBe(1);
    expect(await count('legal_acceptances')).toBe(2);
    expect(await count('durable_challenge_delivery')).toBe(1);
    expect(await count('outbox_events')).toBe(1);
  });

  it('does not remove unexpired challenges or recently expired receipts', async () => {
    await service.registerPending(patient, writeChallenge, randomUUID());
    expect(await cleanup.pruneExpired()).toBe(0);
    await inSchema((runner) =>
      runner.query(
        "UPDATE registration_attempts SET challenge_expires_at = now() - interval '23 hours'",
      ),
    );
    expect(await cleanup.pruneExpired()).toBe(0);
    expect(await count('registration_attempts')).toBe(1);
  });

  it('validates cleanup batch bounds without opening a transaction', async () => {
    await expect(cleanup.pruneExpired(0)).rejects.toThrow();
    await expect(cleanup.pruneExpired(501)).rejects.toThrow();
    await expect(cleanup.pruneExpired(1.5)).rejects.toThrow();
    await expect(cleanup.pruneExpired(Number.NaN)).rejects.toThrow();
  });

  it('skips retry records currently locked by another transaction', async () => {
    await service.registerPending(patient, writeChallenge, randomUUID());
    await inSchema((runner) =>
      runner.query(
        "UPDATE registration_attempts SET challenge_expires_at = now() - interval '25 hours'",
      ),
    );
    const locked = database.createQueryRunner();
    await locked.connect();
    try {
      await locked.startTransaction();
      await locked.query(`SET LOCAL search_path TO "${schema}", public`);
      await locked.query(
        'SELECT request_key_hash FROM registration_attempts FOR UPDATE',
      );
      expect(await cleanup.pruneExpired(10)).toBe(0);
      expect(await count('registration_attempts')).toBe(1);
    } finally {
      if (locked.isTransactionActive) await locked.rollbackTransaction();
      await locked.release();
    }
    expect(await cleanup.pruneExpired(10)).toBe(1);
    expect(await count('registration_attempts')).toBe(0);
    expect(await count('users')).toBe(1);
  });

  it('cannot recreate account or delivery after an expired retry receipt is pruned', async () => {
    const key = randomUUID();
    await service.registerPending(patient, writeChallenge, key);
    await inSchema((runner) =>
      runner.query(
        "UPDATE registration_attempts SET challenge_expires_at = now() - interval '25 hours'",
      ),
    );

    expect(await cleanup.pruneExpired(10)).toBe(1);
    expect(await count('registration_attempts')).toBe(0);
    await expect(
      service.registerPending(patient, writeChallenge, key),
    ).rejects.toThrow(ConflictException);

    expect(await count('users')).toBe(1);
    expect(await count('patient_profiles')).toBe(1);
    expect(await count('legal_acceptances')).toBe(2);
    expect(await count('outbox_events')).toBe(1);
    expect(await count('durable_challenge_delivery')).toBe(1);
    expect(await count('registration_attempts')).toBe(0);
  });
});
