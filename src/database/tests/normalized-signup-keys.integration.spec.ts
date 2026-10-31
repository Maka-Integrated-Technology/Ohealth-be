import { randomUUID } from 'node:crypto';
import { env } from 'node:process';

import { DataSource, QueryRunner } from 'typeorm';

import { NormalizedSignupKeys1793150000000 } from '../migrations/1793150000000-NormalizedSignupKeys';

const integration = env.PG_INTEGRATION_URL ? describe : describe.skip;

integration('Normalized signup uniqueness (PostgreSQL)', () => {
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
    schema = 'signup_' + randomUUID().replaceAll('-', '');
    await database.query(`CREATE SCHEMA "${schema}"`);
    runner = database.createQueryRunner();
    await runner.connect();
    await runner.query(`SET search_path TO "${schema}", public`);
    await runner.startTransaction();
    await runner.query(
      'CREATE TABLE users (id serial PRIMARY KEY, email varchar NOT NULL)',
    );
    await runner.query(
      'CREATE TABLE organizations (id serial PRIMARY KEY, registration_number varchar NOT NULL)',
    );
  });

  afterEach(async () => {
    if (runner?.isTransactionActive) await runner.rollbackTransaction();
    await runner?.release();
    if (schema)
      await database.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
  });

  afterAll(async () => {
    if (database?.isInitialized) await database.destroy();
  });

  it('rejects legacy normalized email collisions without deleting any rows', async () => {
    await runner.query(
      "INSERT INTO users(email) VALUES ('  Ada@Example.com '), ('ada@example.com')",
    );
    await expect(
      new NormalizedSignupKeys1793150000000().up(runner),
    ).rejects.toThrow('Duplicate normalized user emails');
  });

  it('rejects legacy organization registration collisions without silently merging', async () => {
    await runner.query(
      "INSERT INTO organizations(registration_number) VALUES ('RC-9'), (' rc-9 ')",
    );
    await expect(
      new NormalizedSignupKeys1793150000000().up(runner),
    ).rejects.toThrow('Duplicate normalized registration numbers');
  });

  it('enforces distinct and unique normalized signup keys on new inserts', async () => {
    await new NormalizedSignupKeys1793150000000().up(runner);
    await runner.query("INSERT INTO users(email) VALUES ('ADA@example.com')");
    await runner.query(
      "INSERT INTO organizations(registration_number) VALUES (' RC-100 ')",
    );
    await runner.query("INSERT INTO users(email) VALUES ('other@example.com')");
    await expect(
      runner.query("INSERT INTO users(email) VALUES (' ada@example.com ')"),
    ).rejects.toMatchObject({ code: '23505' });
  });
});
