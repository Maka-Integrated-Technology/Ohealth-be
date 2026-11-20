import { randomUUID } from 'node:crypto';
import { env } from 'node:process';

import { ForbiddenException } from '@nestjs/common';
import { DataSource, EntityManager, QueryRunner, Repository } from 'typeorm';

import { AccountAccessPolicyService } from '../../modules/auth/account-access-policy.service';
import { AuthContextService } from '../../modules/auth/context/auth-context.service';
import { CanonicalProfessionalProfileService } from '../../modules/professional/personal-profile/canonical-professional-profile.service';
import { User } from '../../modules/user/entities/user.entity';

const integration = env.PG_INTEGRATION_URL ? describe : describe.skip;

integration(
  'Canonical professional personal profile persistence (PostgreSQL)',
  () => {
    let database: DataSource;
    let schema: string;
    let ownerId: string;
    let otherId: string;
    let service: CanonicalProfessionalProfileService;

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
      schema = 'professional_basic_' + randomUUID().replaceAll('-', '');
      ownerId = randomUUID();
      otherId = randomUUID();
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
          email varchar NOT NULL, password varchar NOT NULL,
          password_authentication_enabled boolean NOT NULL DEFAULT true,
          first_name varchar NOT NULL, last_name varchar NOT NULL,
          middle_name varchar, gender varchar, dob date, phone varchar,
          country varchar, image varchar, role text NOT NULL DEFAULT 'PATIENT',
          account_status varchar NOT NULL DEFAULT 'active', email_verified_at timestamptz,
          is_active boolean NOT NULL DEFAULT true, is_verified boolean NOT NULL DEFAULT true,
          verification_code varchar, verification_code_expires_at timestamptz,
          google_id varchar, reset_token varchar, reset_token_expiry timestamptz
        )
      `);
        await setup.query(`
        CREATE TABLE user_personas (
          id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
          created_at timestamptz NOT NULL DEFAULT now(),
          updated_at timestamptz NOT NULL DEFAULT now(),
          user_id uuid NOT NULL REFERENCES users(id),
          persona_type varchar NOT NULL, is_active boolean NOT NULL DEFAULT true
        )
      `);
        await setup.query(
          `
        INSERT INTO users (id, email, password, first_name, last_name, email_verified_at)
        VALUES ($1, 'owner@example.test', 'hash', 'Ada', 'Okafor', now()),
               ($2, 'other@example.test', 'hash', 'Other', 'Person', now())
      `,
          [ownerId, otherId],
        );
        await setup.query(
          `
        INSERT INTO user_personas (user_id, persona_type)
        VALUES ($1, 'healthcare_professional'), ($2, 'patient')
      `,
          [ownerId, otherId],
        );
      } finally {
        await setup.release();
      }

      const users = {
        manager: {
          transaction: <T>(callback: (manager: EntityManager) => Promise<T>) =>
            inSchema(callback),
        },
      } as unknown as Repository<User>;
      const context = {
        assertCapabilities: async (actorId: string) => {
          if (actorId !== ownerId)
            throw new ForbiddenException('Professional context required.');
        },
      } as unknown as AuthContextService;
      service = new CanonicalProfessionalProfileService(
        users,
        context,
        new AccountAccessPolicyService(),
      );
    });

    afterEach(async () => database.query(`DROP SCHEMA "${schema}" CASCADE`));
    afterAll(async () => database?.destroy());

    it('updates only the owner, preserves unrelated rows, and repeats safely', async () => {
      await Promise.all([
        service.update(ownerId, 'session', {
          first_name: ' Amaka ',
          country: ' Nigeria ',
        }),
        service.update(ownerId, 'session', {
          first_name: 'Amaka',
          country: 'Nigeria',
        }),
      ]);
      const rows = await inSchema((manager) =>
        manager.query(
          'SELECT id, first_name, country FROM users ORDER BY email',
        ),
      );
      expect(rows).toEqual([
        expect.objectContaining({
          id: otherId,
          first_name: 'Other',
          country: null,
        }),
        expect.objectContaining({
          id: ownerId,
          first_name: 'Amaka',
          country: 'Nigeria',
        }),
      ]);
      await expect(
        service.update(otherId, 'session', { first_name: 'Crossed' }),
      ).rejects.toThrow(ForbiddenException);
      const other = await inSchema((manager) =>
        manager.query('SELECT first_name FROM users WHERE id = $1', [otherId]),
      );
      expect(other[0].first_name).toBe('Other');
    });

    it('fails closed after persona removal or account suspension', async () => {
      await inSchema((manager) =>
        manager.query(
          'UPDATE user_personas SET is_active = false WHERE user_id = $1',
          [ownerId],
        ),
      );
      await expect(
        service.update(ownerId, 'session', { first_name: 'New' }),
      ).rejects.toThrow(ForbiddenException);
      await inSchema((manager) =>
        manager.query(
          'UPDATE user_personas SET is_active = true WHERE user_id = $1',
          [ownerId],
        ),
      );
      await inSchema((manager) =>
        manager.query(
          "UPDATE users SET account_status = 'suspended' WHERE id = $1",
          [ownerId],
        ),
      );
      await expect(
        service.update(ownerId, 'session', { first_name: 'New' }),
      ).rejects.toThrow();
    });
  },
);
