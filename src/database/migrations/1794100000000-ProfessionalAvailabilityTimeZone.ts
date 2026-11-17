import { MigrationInterface, QueryRunner } from 'typeorm';

export class ProfessionalAvailabilityTimeZone1794100000000 implements MigrationInterface {
  name = 'ProfessionalAvailabilityTimeZone1794100000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    // A slot stores a calendar date and wall-clock times, and until now
    // nothing recorded which time zone they are local to. Every existing slot
    // was written through a contract that carries no zone, in the platform's
    // scheduling zone, so that zone is recorded on those rows. The default
    // keeps a slot written without a zone in that same zone.
    await queryRunner.query(`
      ALTER TABLE "professional_availabilities"
      ADD "time_zone" character varying(64) NOT NULL DEFAULT 'Africa/Lagos'
    `);
    // Only an IANA area/location name that PostgreSQL can resolve is stored.
    // Abbreviations and fixed offsets are refused, and an unknown name fails
    // the conversion itself.
    await queryRunner.query(`
      ALTER TABLE "professional_availabilities"
      ADD CONSTRAINT "CHK_professional_availabilities_time_zone"
      CHECK (
        "time_zone" ~ '^[A-Za-z]+(/[A-Za-z0-9_+-]+)+$'
        AND (("date" + "start_time") AT TIME ZONE "time_zone") IS NOT NULL
      )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "professional_availabilities"
      DROP CONSTRAINT "CHK_professional_availabilities_time_zone"
    `);
    await queryRunner.query(`
      ALTER TABLE "professional_availabilities" DROP COLUMN "time_zone"
    `);
  }
}
