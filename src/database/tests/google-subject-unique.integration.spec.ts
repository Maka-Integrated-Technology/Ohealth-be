import { randomUUID } from 'node:crypto';
import { env } from 'node:process';

import { DataSource, QueryRunner } from 'typeorm';

import { UniqueGoogleSubject1793170000000 } from '../migrations/1793170000000-UniqueGoogleSubject';

const integration = env.PG_INTEGRATION_URL ? describe : describe.skip;

integration('Google provider subject uniqueness on PostgreSQL', () => {
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
    schema = 'google_link_' + randomUUID().replaceAll('-', '');
    await database.query(`CREATE SCHEMA "${schema}"`);
    runner = database.createQueryRunner();
    await runner.connect();
    await runner.query(`SET search_path TO "${schema}", public`);
    await runner.startTransaction();
    await runner.query(
      'CREATE TABLE users (id serial PRIMARY KEY, google_id varchar NULL)',
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

  it('blocks migrations over ambiguous existing provider ownership', async () => {
    await runner.query(
      "INSERT INTO users (google_id) VALUES ('same-subject'), ('same-subject')",
    );
    await expect(
      new UniqueGoogleSubject1793170000000().up(runner),
    ).rejects.toThrow(
      'Duplicate Google subjects require manual security review',
    );
  });

  it('permits multiple unlinked accounts and prevents duplicate Google subject', async () => {
    await new UniqueGoogleSubject1793170000000().up(runner);
    await runner.query(
      "INSERT INTO users (google_id) VALUES (NULL), (NULL), ('google-subject-1')",
    );
    await expect(
      runner.query("INSERT INTO users (google_id) VALUES ('google-subject-1')"),
    ).rejects.toMatchObject({ code: '23505' });
  });
});
