import { MigrationInterface, QueryRunner } from 'typeorm';

/** Additive only. Existing patient medical profiles and users are preserved. */
export class PatientPersonalAddress1793200000000 implements MigrationInterface {
  name = 'PatientPersonalAddress1793200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "patient_profiles" ADD COLUMN IF NOT EXISTS "address" varchar(500)',
    );
  }

  public async down(): Promise<void> {
    throw new Error(
      'Patient addresses must be explicitly migrated before dropping this field.',
    );
  }
}
