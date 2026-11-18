import { randomUUID } from 'node:crypto';
import { env } from 'node:process';

import { DataSource, QueryRunner } from 'typeorm';

import { PLATFORM_SCHEDULING_TIME_ZONE } from '../../modules/professional/professional-availability.constants';
import { ProfessionalAvailabilityTimeZone1794200000000 } from '../migrations/1794200000000-ProfessionalAvailabilityTimeZone';

const integration = env.PG_INTEGRATION_URL ? describe : describe.skip;

integration('Professional availability time zone migration', () => {
  const migration = new ProfessionalAvailabilityTimeZone1794200000000();
  let dataSource: DataSource;
  let runner: QueryRunner;
  let schemaName: string;

  const insertSlot = (timeZone?: string | null, startTime = '09:00') =>
    timeZone === undefined
      ? runner.query(
          `INSERT INTO professional_availabilities (id, date, start_time, end_time)
           VALUES ($1, '2026-07-15', $2, '09:30')`,
          [randomUUID(), startTime],
        )
      : runner.query(
          `INSERT INTO professional_availabilities (id, date, start_time, end_time, time_zone)
           VALUES ($1, '2026-07-15', $2, '09:30', $3)`,
          [randomUUID(), startTime, timeZone],
        );

  const timeZones = async (): Promise<string[]> => {
    const rows: Array<{ time_zone: string }> = await runner.query(
      'SELECT time_zone FROM professional_availabilities ORDER BY start_time',
    );
    return rows.map((row) => row.time_zone);
  };

  beforeAll(async () => {
    dataSource = new DataSource({
      type: 'postgres',
      url: env.PG_INTEGRATION_URL,
    });
    await dataSource.initialize();
  });

  beforeEach(async () => {
    schemaName = 'availability_zone_' + randomUUID().replaceAll('-', '');
    await dataSource.query(`CREATE SCHEMA "${schemaName}"`);
    runner = dataSource.createQueryRunner();
    await runner.connect();
    await runner.query(`SET search_path TO "${schemaName}", public`);
    // The table as it was before the migration, without a time zone.
    await runner.query(`
      CREATE TABLE professional_availabilities (
        id uuid PRIMARY KEY,
        date date NOT NULL,
        start_time time NOT NULL,
        end_time time NOT NULL,
        is_available boolean NOT NULL DEFAULT true
      )
    `);
  });

  afterEach(async () => {
    await runner?.release();
    await dataSource.query(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
  });

  afterAll(async () => dataSource.destroy());

  it('records the platform scheduling zone on every existing slot', async () => {
    await insertSlot(undefined, '09:00');
    await insertSlot(undefined, '10:00');

    await migration.up(runner);

    expect(await timeZones()).toEqual([
      PLATFORM_SCHEDULING_TIME_ZONE,
      PLATFORM_SCHEDULING_TIME_ZONE,
    ]);
  });

  it('gives a slot written without a zone the platform scheduling zone', async () => {
    await migration.up(runner);

    await insertSlot(undefined);

    expect(await timeZones()).toEqual([PLATFORM_SCHEDULING_TIME_ZONE]);
    expect(PLATFORM_SCHEDULING_TIME_ZONE).toBe('Africa/Lagos');
  });

  it('never leaves a slot without a zone', async () => {
    await migration.up(runner);

    await expect(insertSlot(null)).rejects.toMatchObject({ code: '23502' });
  });

  it.each([
    ['America/New_York'],
    ['America/Argentina/Buenos_Aires'],
    ['Etc/UTC'],
    ['Etc/GMT+1'],
  ])('stores the IANA zone %s', async (timeZone) => {
    await migration.up(runner);

    await insertSlot(timeZone);

    expect(await timeZones()).toEqual([timeZone]);
  });

  it.each([
    ['WAT'],
    ['EST'],
    ['UTC'],
    ['UTC+1'],
    ['+01:00'],
    [''],
    ['Africa/Lagos; DROP TABLE users'],
    // Well formed, but not a zone PostgreSQL knows.
    ['Mars/Phobos'],
  ])('refuses %j as a time zone', async (timeZone) => {
    await migration.up(runner);

    // Either the format check or the zone lookup refuses the value.
    await expect(insertSlot(timeZone)).rejects.toMatchObject({
      code: expect.stringMatching(/^(23514|22023)$/),
    });
    expect(await timeZones()).toEqual([]);
  });

  it('resolves a slot to one instant from its own zone', async () => {
    await migration.up(runner);
    await insertSlot('Africa/Lagos', '09:00');
    await insertSlot('America/New_York', '10:00');

    const rows: Array<{ starts_at: Date }> = await runner.query(`
      SELECT ("date" + "start_time") AT TIME ZONE "time_zone" AS starts_at
      FROM professional_availabilities ORDER BY start_time
    `);

    expect(rows.map((row) => row.starts_at.toISOString())).toEqual([
      '2026-07-15T08:00:00.000Z',
      '2026-07-15T14:00:00.000Z',
    ]);
  });

  it('rolls back to the previous table and keeps the slots', async () => {
    await insertSlot(undefined);
    await migration.up(runner);
    await migration.down(runner);

    const columns: Array<{ column_name: string }> = await runner.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema = $1 AND table_name = 'professional_availabilities'`,
      [schemaName],
    );
    const constraints: Array<{ conname: string }> = await runner.query(
      `SELECT conname FROM pg_constraint
       WHERE conname = 'CHK_professional_availabilities_time_zone'
         AND connamespace = $1::regnamespace`,
      [schemaName],
    );
    const [{ total }]: Array<{ total: string }> = await runner.query(
      'SELECT COUNT(*) AS total FROM professional_availabilities',
    );

    expect(columns.map((column) => column.column_name)).not.toContain(
      'time_zone',
    );
    expect(constraints).toEqual([]);
    expect(total).toBe('1');
  });
});
