import { MigrationInterface, QueryRunner } from 'typeorm';

/** Normalized uniqueness and HMAC-only retry receipts for canonical signup. */
export class TransactionalIntentRegistration1793600000000 implements MigrationInterface {
  name = 'TransactionalIntentRegistration1793600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        IF EXISTS (
          SELECT 1 FROM users
          GROUP BY lower(btrim(email))
          HAVING count(*) > 1
        ) THEN
          RAISE EXCEPTION 'Duplicate normalized user emails require manual reconciliation';
        END IF;
        IF EXISTS (
          SELECT 1 FROM organizations
          GROUP BY lower(btrim(registration_number))
          HAVING count(*) > 1
        ) THEN
          RAISE EXCEPTION 'Duplicate normalized organization registration numbers require manual reconciliation';
        END IF;
      END $$
    `);
    await queryRunner.query(
      'CREATE UNIQUE INDEX "UQ_users_email_normalized" ' +
        'ON "users" (lower(btrim("email")))',
    );
    await queryRunner.query(
      'CREATE UNIQUE INDEX "UQ_organizations_registration_normalized" ' +
        'ON "organizations" (lower(btrim("registration_number")))',
    );
    await queryRunner.query(`
      CREATE TABLE "registration_attempts" (
        "request_key_hash" char(64) PRIMARY KEY,
        "request_fingerprint" char(64) NOT NULL,
        "user_id" uuid NOT NULL,
        "challenge_id" uuid NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "FK_registration_attempts_user"
          FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_registration_attempts_challenge"
          FOREIGN KEY ("challenge_id") REFERENCES "auth_challenges"("id") ON DELETE CASCADE,
        CONSTRAINT "CHK_registration_attempts_key_hash"
          CHECK ("request_key_hash" ~ '^[a-f0-9]{64}$'),
        CONSTRAINT "CHK_registration_attempts_fingerprint"
          CHECK ("request_fingerprint" ~ '^[a-f0-9]{64}$')
      )
    `);
    await queryRunner.query(
      'CREATE INDEX "IDX_registration_attempts_user" ' +
        'ON "registration_attempts" ("user_id")',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_registration_attempts_retention" ' +
        'ON "registration_attempts" ("created_at", "request_key_hash")',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE "registration_attempts"');
    await queryRunner.query(
      'DROP INDEX "UQ_organizations_registration_normalized"',
    );
    await queryRunner.query('DROP INDEX "UQ_users_email_normalized"');
  }
}
