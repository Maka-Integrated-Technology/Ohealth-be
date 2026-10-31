import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * HMAC-only retry journal for pending signup. Contains no raw idempotency
 * keys, passwords, verification codes, provider claims or auth tokens.
 */
export class RegistrationIdempotency1793160000000 implements MigrationInterface {
  name = 'RegistrationIdempotency1793160000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "registration_attempts" (
        "request_key_hash" char(64) PRIMARY KEY,
        "request_fingerprint" char(64) NOT NULL,
        "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "challenge_id" uuid NOT NULL,
        "challenge_expires_at" timestamptz NOT NULL,
        "resend_after_at" timestamptz NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "CHK_registration_attempts_key_hash"
          CHECK ("request_key_hash" ~ '^[a-f0-9]{64}$'),
        CONSTRAINT "CHK_registration_attempts_fingerprint"
          CHECK ("request_fingerprint" ~ '^[a-f0-9]{64}$')
      )
    `);
    await queryRunner.query(
      'CREATE INDEX "IDX_registration_attempts_user" ON "registration_attempts" ("user_id")',
    );
  }

  public async down(): Promise<void> {
    throw new Error(
      'Registration retry journal requires an explicit audited rollback.',
    );
  }
}
