import { MigrationInterface, QueryRunner } from 'typeorm';

export class ProfessionalOnboardingFields1771000000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "professionals"
        ADD COLUMN IF NOT EXISTS "license_number" character varying,
        ADD COLUMN IF NOT EXISTS "verification_status" character varying NOT NULL DEFAULT 'pending',
        ADD COLUMN IF NOT EXISTS "profile_setup_completed" boolean NOT NULL DEFAULT false;
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_professionals_license_number"
        ON "professionals" ("license_number")
        WHERE "license_number" IS NOT NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "UQ_professionals_license_number";
    `);

    await queryRunner.query(`
      ALTER TABLE "professionals"
        DROP COLUMN IF EXISTS "profile_setup_completed",
        DROP COLUMN IF EXISTS "verification_status",
        DROP COLUMN IF EXISTS "license_number";
    `);
  }
}
