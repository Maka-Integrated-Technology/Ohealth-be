import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Professional onboarding resolves the selected discipline against the
 * specialities catalogue. Keep the catalogue available in every environment
 * where migrations run; the booking seed is intentionally development-only.
 */
export class EnsureProfessionalSpecialities1787931040000 implements MigrationInterface {
  name = 'EnsureProfessionalSpecialities1787931040000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO "specialities" ("name", "description", "icon", "is_active")
      VALUES
        (
          'General Doctor',
          'Primary care consultations for common symptoms, checkups, and general health concerns.',
          'general-doctor',
          true
        ),
        (
          'Nurse',
          'Nursing support, care guidance, vitals review, and follow-up health education.',
          'nurse',
          true
        ),
        (
          'Nutritionist',
          'Diet, meal planning, weight management, and nutrition support.',
          'nutritionist',
          true
        ),
        (
          'Counsellor',
          'Mental wellness, stress management, emotional support, and counselling sessions.',
          'counsellor',
          true
        )
      ON CONFLICT ("name") DO UPDATE
        SET "is_active" = true
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM "specialities"
      WHERE "name" IN ('General Doctor', 'Nurse', 'Nutritionist', 'Counsellor')
        AND NOT EXISTS (
          SELECT 1
          FROM "professionals"
          WHERE "professionals"."speciality_id" = "specialities"."id"
        )
    `);
  }
}
