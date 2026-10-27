import { randomUUID } from 'node:crypto';
import { env } from 'node:process';

import { ConflictException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource, EntityManager, QueryRunner } from 'typeorm';

import { RegisterAccountDto } from '../../modules/auth/contracts/register-account.dto';
import { SignupIntent } from '../../modules/auth/enums/signup-intent.enum';
import { PasswordCredentialsService } from '../../modules/auth/password-policy/password-credentials.service';
import { RegistrationRecordsService } from '../../modules/auth/registration/registration-records.service';
import { User } from '../../modules/user/entities/user.entity';
import { NormalizedSignupKeys1793150000000 } from '../migrations/1793150000000-NormalizedSignupKeys';

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
    } finally {
      await setup.release();
    }

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
});
