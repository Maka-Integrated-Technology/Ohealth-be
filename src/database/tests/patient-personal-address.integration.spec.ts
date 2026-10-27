import { randomUUID } from 'node:crypto';
import { env } from 'node:process';

import { DataSource, QueryRunner } from 'typeorm';

import { PatientPersonalAddress1793200000000 } from '../migrations/1793200000000-PatientPersonalAddress';

const integration = env.PG_INTEGRATION_URL ? describe : describe.skip;

integration('Additive patient address migration (PostgreSQL)', () => {
  let database: DataSource;
  let runner: QueryRunner;
  let schema: string;

  beforeAll(async () => {
    database = new DataSource({
      type: 'postgres',
      url: env.PG_INTEGRATION_URL,
      synchronize: false,
    });
    await database.initialize();
  });

  beforeEach(async () => {
    schema = 'profile_' + randomUUID().replaceAll('-', '');
    await database.query(`CREATE SCHEMA "${schema}"`);
    runner = database.createQueryRunner();
    await runner.connect();
    await runner.query(`SET search_path TO "${schema}", public`);
    await runner.startTransaction();
    await runner.query(`
      CREATE TABLE patient_profiles (
        id integer PRIMARY KEY,
        medical_conditions varchar,
        allergies varchar
      )
    `);
    await runner.query(
      "INSERT INTO patient_profiles (id, medical_conditions, allergies) VALUES (1, 'hypertension', 'none')",
    );
  });

  afterEach(async () => {
    if (runner?.isTransactionActive) await runner.rollbackTransaction();
    await runner?.release();
    if (schema) await database.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
  });

  afterAll(async () => {
    if (database?.isInitialized) await database.destroy();
  });

  it('preserves clinical fields and adds a nullable patient address', async () => {
    await new PatientPersonalAddress1793200000000().up(runner);
    const [row] = await runner.query(
      'SELECT id, medical_conditions, allergies, address FROM patient_profiles',
    );
    expect(row).toMatchObject({
      id: 1,
      medical_conditions: 'hypertension',
      allergies: 'none',
      address: null,
    });
    await runner.query(
      'UPDATE patient_profiles SET address = $1 WHERE id = 1',
      ['Abuja, Nigeria'],
    );
    const [updated] = await runner.query(
      'SELECT medical_conditions, allergies, address FROM patient_profiles',
    );
    expect(updated).toEqual({
      medical_conditions: 'hypertension',
      allergies: 'none',
      address: 'Abuja, Nigeria',
    });
  });

  it('is additive and can be applied twice without modifying existing data', async () => {
    const migration = new PatientPersonalAddress1793200000000();
    await migration.up(runner);
    await runner.query(
      "UPDATE patient_profiles SET address = 'Already saved' WHERE id = 1",
    );
    await migration.up(runner);
    const [row] = await runner.query(
      'SELECT address FROM patient_profiles WHERE id = 1',
    );
    expect(row.address).toBe('Already saved');
  });
});
