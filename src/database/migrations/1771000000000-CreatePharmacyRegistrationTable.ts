import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePharmacyRegistrationTable1771000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "public"."pharmacies_verification_status_enum" AS ENUM (
        'submitted',
        'under_review',
        'approved',
        'rejected'
      );
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "pharmacies" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "name" character varying NOT NULL,
        "registration_number" character varying NOT NULL,
        "license_number" character varying NOT NULL,
        "business_address" text NOT NULL,
        "region" character varying NOT NULL,
        "contact_email" character varying NOT NULL,
        "contact_phone" character varying NOT NULL,
        "verification_status" "public"."pharmacies_verification_status_enum" NOT NULL DEFAULT 'submitted',
        "is_active" boolean NOT NULL DEFAULT true,
        CONSTRAINT "PK_pharmacies_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_pharmacies_registration_number" UNIQUE ("registration_number"),
        CONSTRAINT "UQ_pharmacies_license_number" UNIQUE ("license_number")
      );
    `);

    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_pharmacies_region" ON "pharmacies" ("region");',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_pharmacies_verification_status" ON "pharmacies" ("verification_status");',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'DROP INDEX IF EXISTS "IDX_pharmacies_verification_status";',
    );
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_pharmacies_region";');
    await queryRunner.query('DROP TABLE IF EXISTS "pharmacies";');
    await queryRunner.query(
      'DROP TYPE IF EXISTS "public"."pharmacies_verification_status_enum";',
    );
  }
}
