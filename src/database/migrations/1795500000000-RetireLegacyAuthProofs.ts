import { MigrationInterface, QueryRunner } from 'typeorm';

/** Retain rollback columns, but make legacy plaintext proofs inert at the DB boundary. */
export class RetireLegacyAuthProofs1795500000000 implements MigrationInterface {
  name = 'RetireLegacyAuthProofs1795500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // New rows must not silently acquire a global patient role. Keep existing
    // values and the column for rollback reconciliation.
    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "role" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "role" DROP NOT NULL`,
    );
    await queryRunner.query(`
      UPDATE "users"
      SET "verification_code" = NULL,
          "verification_code_expires_at" = NULL,
          "reset_token" = NULL,
          "reset_token_expiry" = NULL
      WHERE "verification_code" IS NOT NULL
         OR "verification_code_expires_at" IS NOT NULL
         OR "reset_token" IS NOT NULL
         OR "reset_token_expiry" IS NOT NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "users" ADD CONSTRAINT "CHK_users_retired_auth_proofs_inert"
      CHECK ("verification_code" IS NULL AND "verification_code_expires_at" IS NULL
        AND "reset_token" IS NULL AND "reset_token_expiry" IS NULL)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" DROP CONSTRAINT "CHK_users_retired_auth_proofs_inert"`,
    );
  }
}
