import { randomUUID } from 'node:crypto';
import { env } from 'node:process';

import { ForbiddenException } from '@nestjs/common';
import { DataSource, EntityManager, QueryRunner, Repository } from 'typeorm';

import { AccountAccessPolicyService } from '../../modules/auth/account-access-policy.service';
import { CanonicalAuthContextService } from '../../modules/auth/context/canonical-auth-context.service';
import { UserPersona } from '../../modules/identity/entities/user-persona.entity';
import { PatientProfile } from '../../modules/patient/entities/patient-profile.entity';
import { CanonicalPatientProfileService } from '../../modules/patient/personal-profile/canonical-patient-profile.service';
import { User } from '../../modules/user/entities/user.entity';

const integration = env.PG_INTEGRATION_URL ? describe : describe.skip;

integration('Canonical patient personal profile persistence (PostgreSQL)', () => {
  let database: DataSource;
  let schema: string;
  let userId: string;
  let service: CanonicalPatientProfileService;

  async function inSchema<T>(
    operation: (manager: EntityManager) => Promise<T>,
  ): Promise<T> {
    const runner: QueryRunner = database.createQueryRunner();
    await runner.connect();
    try {
      await runner.startTransaction();
      await runner.query(`SET LOCAL search_path TO "${schema}", public`);
      const result = await operation(runner.manager);
      await runner.commitTransaction();
      return result;
    } catch (error) {
      if (runner.isTransactionActive) await runner.rollbackTransaction();
      throw error;
    } finally {
      await runner.release();
    }
  }

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
    schema = 'personal_profile_' + randomUUID().replaceAll('-', '');
    userId = randomUUID();
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
          email varchar NOT NULL,
          password varchar NOT NULL,
          first_name varchar NOT NULL,
          last_name varchar NOT NULL,
          middle_name varchar,
          gender varchar,
          dob date,
          phone varchar,
          country varchar,
          image varchar,
          role text NOT NULL DEFAULT 'PATIENT',
          account_status varchar NOT NULL DEFAULT 'active',
          email_verified_at timestamptz,
          is_active boolean NOT NULL DEFAULT true,
          is_verified boolean NOT NULL DEFAULT true,
          verification_code varchar,
          verification_code_expires_at timestamptz,
          google_id varchar,
          reset_token varchar,
          reset_token_expiry timestamptz
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
          emergency_contact_phone varchar,
          CONSTRAINT "CHK_fixture_safe_address" CHECK (address IS NULL OR address <> 'reject')
        )
      `);
      await setup.query(`
        INSERT INTO users
          (id, email, password, first_name, last_name, account_status,
           email_verified_at, is_active, is_verified)
        VALUES ($1, 'ada@example.test', 'test-hash', 'Ada', 'Okafor', 'active',
                now(), true, true)
      `, [userId]);
      await setup.query(
        'INSERT INTO user_personas (user_id, persona_type, is_active) VALUES ($1, $2, true)',
        [userId, 'patient'],
      );
      await setup.query(
        "INSERT INTO patient_profiles (user_id, address, medical_conditions) VALUES ($1, 'Old Street', 'preserve-existing')",
        [userId],
      );
    } finally {
      await setup.release();
    }

    const userRepository = {
      findOne: (options: unknown) =>
        inSchema((manager) => manager.findOne(User, options as never)),
      manager: {
        transaction: <T>(callback: (manager: EntityManager) => Promise<T>) =>
          inSchema(callback),
      },
    } as unknown as Repository<User>;

    const patientRepository = {
      findOne: (options: unknown) =>
        inSchema((manager) => manager.findOne(PatientProfile, options as never)),
    } as unknown as Repository<PatientProfile>;

    // A future session adapter supplies this verified actor ID from #77.
    // This test explicitly does not simulate or create a login session.
    const context = {
      assertCanReadPatientProfile: async (actorId: string) => {
        if (actorId !== userId) throw new ForbiddenException('Not profile owner.');
      },
      assertCanEditPatientProfile: async (actorId: string) => {
        if (actorId !== userId) throw new ForbiddenException('Not profile owner.');
      },
    } as unknown as CanonicalAuthContextService;

    service = new CanonicalPatientProfileService(
      userRepository,
      patientRepository,
      context,
      new AccountAccessPolicyService(),
    );
  });

  afterEach(async () => {
    if (schema) await database.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
  });

  afterAll(async () => {
    if (database?.isInitialized) await database.destroy();
  });

  it('updates ordinary fields while preserving medical records and contacts', async () => {
    const updated = await service.update(userId, {
      first_name: 'Amaka',
      address: 'New Street',
    });
    expect(updated.first_name).toBe('Amaka');
    expect(updated.address).toBe('New Street');
    const rows: Array<{
      first_name: string;
      address: string;
      medical_conditions: string;
      email: string;
    }> = await inSchema((manager) =>
      manager.query(`
        SELECT u.first_name, u.email, p.address, p.medical_conditions
        FROM users u JOIN patient_profiles p ON p.user_id = u.id
      `),
    );
    expect(rows[0]).toEqual({
      first_name: 'Amaka',
      address: 'New Street',
      medical_conditions: 'preserve-existing',
      email: 'ada@example.test',
    });
    const read = await service.get(userId);
    expect(read).toMatchObject({ first_name: 'Amaka', address: 'New Street' });
    expect(read).not.toHaveProperty('medical_conditions');
    expect(read).not.toHaveProperty('password');
  });

  it('rolls back the name change if a later address write violates a constraint', async () => {
    await expect(
      service.update(userId, {
        first_name: 'Should not persist',
        address: 'reject',
      }),
    ).rejects.toThrow();
    const rows: Array<{ first_name: string; address: string }> =
      await inSchema((manager) =>
        manager.query(`
          SELECT u.first_name, p.address
          FROM users u JOIN patient_profiles p ON p.user_id = u.id
        `),
      );
    expect(rows[0]).toEqual({
      first_name: 'Ada',
      address: 'Old Street',
    });
  });

  it('does not change profile fields for a suspended user or inactive patient persona', async () => {
    await inSchema((manager) =>
      manager.query('UPDATE users SET account_status = $1, is_active = false WHERE id = $2', [
        'suspended',
        userId,
      ]),
    );
    await expect(
      service.update(userId, { address: 'Not permitted' }),
    ).rejects.toThrow();
    await inSchema((manager) =>
      manager.query("UPDATE users SET account_status = 'active', is_active = true WHERE id = $1", [
        userId,
      ]),
    );
    await inSchema((manager) =>
      manager.update(UserPersona, { user_id: userId }, { is_active: false }),
    );
    await expect(
      service.update(userId, { first_name: 'Not permitted' }),
    ).rejects.toThrow(ForbiddenException);
    const [row] = await inSchema((manager) =>
      manager.query('SELECT first_name FROM users WHERE id = $1', [userId]),
    );
    expect(row.first_name).toBe('Ada');
  });

  it('rejects another actor and protected fields before opening a write transaction', async () => {
    await expect(
      service.update(randomUUID(), { first_name: 'Intruder' }),
    ).rejects.toThrow(ForbiddenException);
    await expect(
      service.update(userId, {
        email: 'attacker@example.test',
      } as never),
    ).rejects.toThrow();
    const [row] = await inSchema((manager) =>
      manager.query('SELECT first_name, email FROM users WHERE id = $1', [userId]),
    );
    expect(row).toEqual({
      first_name: 'Ada',
      email: 'ada@example.test',
    });
  });

  it('supports repeated identical updates without disturbing saved records', async () => {
    await service.update(userId, { first_name: 'Ada', address: 'Old Street' });
    await service.update(userId, { first_name: 'Ada', address: 'Old Street' });
    const rows = await inSchema((manager) =>
      manager.query('SELECT address, medical_conditions FROM patient_profiles'),
    );
    expect(rows).toEqual([
      { address: 'Old Street', medical_conditions: 'preserve-existing' },
    ]);
  });
});
