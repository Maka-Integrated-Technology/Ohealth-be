import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Additive cleanup index for the HMAC-only pending registration retry journal.
 * No identity, challenge, legal acceptance, or outbox rows are removed.
 */
export class RegistrationRetryRetentionIndex1793165000000 implements MigrationInterface {
  name = 'RegistrationRetryRetentionIndex1793165000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'CREATE INDEX "IDX_registration_attempts_expiry" ON "registration_attempts" ("challenge_expires_at", "request_key_hash")',
    );
  }

  public async down(): Promise<void> {
    throw new Error(
      'Registration retry retention indexes require an explicitly reviewed rollback.',
    );
  }
}
