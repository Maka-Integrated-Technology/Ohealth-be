import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddLaboratoryVerificationStatusLifecycle1771400000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "laboratories"
      DROP CONSTRAINT IF EXISTS "CHK_laboratories_verification_status";
    `);

    await queryRunner.query(`
      ALTER TABLE "laboratories"
      ADD COLUMN IF NOT EXISTS "verification_rejection_reason" text;
    `);

    await queryRunner.query(`
      UPDATE "laboratories"
      SET "verification_status" = 'approved'
      WHERE "verification_status" = 'verified';
    `);

    await queryRunner.query(`
      UPDATE "laboratories"
      SET "verification_rejection_reason" = 'Legacy rejection reason unavailable'
      WHERE "verification_status" = 'rejected'
        AND NULLIF(BTRIM("verification_rejection_reason"), '') IS NULL;
    `);

    await queryRunner.query(`
      ALTER TABLE "laboratories"
      ADD CONSTRAINT "CHK_laboratories_verification_status"
      CHECK ("verification_status" IN ('pending', 'submitted', 'under_review', 'approved', 'rejected'));
    `);

    await queryRunner.query(`
      ALTER TABLE "laboratories"
      ADD CONSTRAINT "CHK_laboratories_verification_rejection_reason"
      CHECK ("verification_status" <> 'rejected' OR NULLIF(BTRIM("verification_rejection_reason"), '') IS NOT NULL);
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "laboratory_verification_status_history" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "laboratory_id" uuid NOT NULL,
        "previous_status" character varying,
        "new_status" character varying NOT NULL,
        "reason" text,
        "changed_by_user_id" uuid NOT NULL,
        CONSTRAINT "PK_laboratory_verification_status_history_id" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_laboratory_verification_status_history_previous_status" CHECK ("previous_status" IS NULL OR "previous_status" IN ('pending', 'submitted', 'under_review', 'approved', 'rejected')),
        CONSTRAINT "CHK_laboratory_verification_status_history_new_status" CHECK ("new_status" IN ('pending', 'submitted', 'under_review', 'approved', 'rejected')),
        CONSTRAINT "FK_laboratory_verification_status_history_laboratory_id" FOREIGN KEY ("laboratory_id") REFERENCES "laboratories"("id") ON DELETE RESTRICT ON UPDATE NO ACTION,
        CONSTRAINT "FK_laboratory_verification_status_history_changed_by_user_id" FOREIGN KEY ("changed_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION
      );
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_laboratory_verification_status_history_laboratory_id"
        ON "laboratory_verification_status_history" ("laboratory_id");
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_laboratory_verification_status_history_new_status"
        ON "laboratory_verification_status_history" ("new_status");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_laboratory_verification_status_history_new_status";
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_laboratory_verification_status_history_laboratory_id";
    `);

    await queryRunner.query(`
      DROP TABLE IF EXISTS "laboratory_verification_status_history";
    `);

    await queryRunner.query(`
      ALTER TABLE "laboratories"
      DROP CONSTRAINT IF EXISTS "CHK_laboratories_verification_status";
    `);

    await queryRunner.query(`
      ALTER TABLE "laboratories"
      DROP CONSTRAINT IF EXISTS "CHK_laboratories_verification_rejection_reason";
    `);

    await queryRunner.query(`
      UPDATE "laboratories"
      SET "verification_status" = 'verified'
      WHERE "verification_status" = 'approved';
    `);

    await queryRunner.query(`
      UPDATE "laboratories"
      SET "verification_status" = 'pending'
      WHERE "verification_status" IN ('submitted', 'under_review');
    `);

    await queryRunner.query(`
      ALTER TABLE "laboratories"
      DROP COLUMN IF EXISTS "verification_rejection_reason";
    `);
  }
}
