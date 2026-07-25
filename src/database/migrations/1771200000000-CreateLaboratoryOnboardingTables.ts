import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateLaboratoryOnboardingTables1771200000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "laboratories" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "name" character varying NOT NULL,
        "registration_number" character varying NOT NULL,
        "license_number" character varying NOT NULL,
        "address" text NOT NULL,
        "region" character varying NOT NULL,
        "contact_email" character varying NOT NULL,
        "contact_phone" character varying NOT NULL,
        "verification_status" character varying NOT NULL DEFAULT 'pending',
        "onboarding_status" character varying NOT NULL DEFAULT 'laboratory_created',
        "is_active" boolean NOT NULL DEFAULT true,
        CONSTRAINT "PK_laboratories_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_laboratories_registration_number" UNIQUE ("registration_number"),
        CONSTRAINT "UQ_laboratories_license_number" UNIQUE ("license_number")
      );
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_laboratories_region"
        ON "laboratories" ("region");
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_laboratories_verification_status"
        ON "laboratories" ("verification_status");
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "laboratory_admins" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "laboratory_id" uuid NOT NULL,
        "user_id" uuid NOT NULL,
        "full_name" character varying NOT NULL,
        "phone" character varying NOT NULL,
        "is_primary" boolean NOT NULL DEFAULT true,
        CONSTRAINT "PK_laboratory_admins_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_laboratory_admins_user_id" UNIQUE ("user_id"),
        CONSTRAINT "UQ_laboratory_admins_laboratory_user" UNIQUE ("laboratory_id", "user_id"),
        CONSTRAINT "FK_laboratory_admins_laboratory_id" FOREIGN KEY ("laboratory_id") REFERENCES "laboratories"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "FK_laboratory_admins_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
      );
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_laboratory_admins_laboratory_id"
        ON "laboratory_admins" ("laboratory_id");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_laboratory_admins_laboratory_id";
    `);

    await queryRunner.query(`
      DROP TABLE IF EXISTS "laboratory_admins";
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_laboratories_verification_status";
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_laboratories_region";
    `);

    await queryRunner.query(`
      DROP TABLE IF EXISTS "laboratories";
    `);
  }
}
