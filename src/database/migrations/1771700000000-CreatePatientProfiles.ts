import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePatientProfiles1771700000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "patient_profiles" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "user_id" uuid NOT NULL,
        "patient_reference" character varying,
        "medical_conditions" text,
        "allergies" text,
        "blood_group" character varying,
        "emergency_contact_name" character varying,
        "emergency_contact_phone" character varying,
        CONSTRAINT "PK_patient_profiles_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_patient_profiles_user_id" UNIQUE ("user_id"),
        CONSTRAINT "FK_patient_profiles_user_id"
          FOREIGN KEY ("user_id") REFERENCES "users"("id")
          ON DELETE CASCADE ON UPDATE NO ACTION
      );

      CREATE INDEX "IDX_patient_profiles_patient_reference"
        ON "patient_profiles" ("patient_reference");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'DROP INDEX IF EXISTS "IDX_patient_profiles_patient_reference";',
    );
    await queryRunner.query('DROP TABLE IF EXISTS "patient_profiles";');
  }
}
