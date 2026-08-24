import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateProfessionalPatientNotesAndVitals1771800000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "patient_profiles"
        ADD COLUMN "height_cm" integer,
        ADD COLUMN "weight_kg" double precision,
        ADD COLUMN "genotype" character varying;

      CREATE TABLE "professional_patient_notes" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "professional_id" uuid NOT NULL,
        "patient_id" uuid NOT NULL,
        "content" text NOT NULL,
        CONSTRAINT "PK_professional_patient_notes_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_professional_patient_notes_professional_id"
          FOREIGN KEY ("professional_id") REFERENCES "professionals"("id")
          ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "FK_professional_patient_notes_patient_id"
          FOREIGN KEY ("patient_id") REFERENCES "users"("id")
          ON DELETE CASCADE ON UPDATE NO ACTION
      );

      CREATE INDEX "IDX_professional_patient_notes_prof_patient_created"
        ON "professional_patient_notes" (
          "professional_id",
          "patient_id",
          "created_at"
        );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'DROP INDEX IF EXISTS "IDX_professional_patient_notes_prof_patient_created";',
    );
    await queryRunner.query(
      'DROP TABLE IF EXISTS "professional_patient_notes";',
    );
    await queryRunner.query(`
      ALTER TABLE "patient_profiles"
        DROP COLUMN IF EXISTS "genotype",
        DROP COLUMN IF EXISTS "weight_kg",
        DROP COLUMN IF EXISTS "height_cm";
    `);
  }
}
