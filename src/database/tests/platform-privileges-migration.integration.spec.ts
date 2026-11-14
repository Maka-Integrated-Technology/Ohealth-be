import { randomUUID } from 'node:crypto';
import { env } from 'node:process';

import { DataSource, QueryRunner } from 'typeorm';

import { PlatformPrivileges1793900000000 } from '../migrations/1793900000000-PlatformPrivileges';

const integration = env.PG_INTEGRATION_URL ? describe : describe.skip;

integration('Platform privileges migration on PostgreSQL', () => {
  let dataSource: DataSource;
  let runner: QueryRunner;
  let schemaName: string;

  beforeAll(async () => {
    dataSource = new DataSource({
      type: 'postgres',
      url: env.PG_INTEGRATION_URL,
    });
    await dataSource.initialize();
    await dataSource.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
  });

  beforeEach(async () => {
    schemaName = 'platform_privileges_' + randomUUID().replaceAll('-', '');
    await dataSource.query(`CREATE SCHEMA "${schemaName}"`);
    runner = dataSource.createQueryRunner();
    await runner.connect();
    await runner.query(`SET search_path TO "${schemaName}", public`);
    await runner.query(
      'CREATE TABLE users (id uuid PRIMARY KEY, role varchar)',
    );
  });

  afterEach(async () => {
    await runner?.release();
    await dataSource.query(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
  });

  afterAll(async () => dataSource.destroy());

  it('backfills only exact ADMIN role tokens', async () => {
    const rows = [
      ['ADMIN', true],
      ['PATIENT,ADMIN', true],
      ['ADMIN,PATIENT', true],
      ['PATIENT', false],
      ['LAB_ADMIN', false],
      ['admin', false],
      [null, false],
    ] as const;
    const ids = rows.map(() => randomUUID());
    for (let index = 0; index < rows.length; index += 1) {
      await runner.query('INSERT INTO users (id, role) VALUES ($1, $2)', [
        ids[index],
        rows[index][0],
      ]);
    }

    await new PlatformPrivileges1793900000000().up(runner);
    const privileges = await runner.query(
      'SELECT user_id, privilege FROM platform_privileges ORDER BY user_id',
    );
    expect(privileges).toHaveLength(3);
    expect(privileges.map((row: { user_id: string }) => row.user_id)).toEqual(
      expect.arrayContaining(ids.slice(0, 3)),
    );
  });

  it('enforces uniqueness, allowed values, foreign keys, and cascade deletion', async () => {
    const userId = randomUUID();
    await runner.query(`INSERT INTO users (id, role) VALUES ($1, 'ADMIN')`, [
      userId,
    ]);
    await new PlatformPrivileges1793900000000().up(runner);
    await expect(
      runner.query(
        `INSERT INTO platform_privileges (user_id, privilege) VALUES ($1, 'admin')`,
        [userId],
      ),
    ).rejects.toMatchObject({ code: '23505' });
    await expect(
      runner.query(
        `INSERT INTO platform_privileges (user_id, privilege) VALUES ($1, 'owner')`,
        [userId],
      ),
    ).rejects.toMatchObject({ code: '23514' });
    await expect(
      runner.query(
        `INSERT INTO platform_privileges (user_id, privilege) VALUES ($1, 'admin')`,
        [randomUUID()],
      ),
    ).rejects.toMatchObject({ code: '23503' });
    await runner.query('DELETE FROM users WHERE id = $1', [userId]);
    await expect(
      runner.query('SELECT * FROM platform_privileges'),
    ).resolves.toEqual([]);
  });

  it('rolls back cleanly in a non-public schema', async () => {
    const migration = new PlatformPrivileges1793900000000();
    await migration.up(runner);
    await migration.down(runner);
    const result = await runner.query(
      `SELECT to_regclass('platform_privileges') AS table_name`,
    );
    expect(result[0].table_name).toBeNull();
  });
});
