import { MigrationInterface, QueryRunner } from 'typeorm';

export class HardenCanonicalGoogleOAuth1793801000000 implements MigrationInterface {
  name = 'HardenCanonicalGoogleOAuth1793801000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // A legacy Google-only account received an unknowable bcrypt placeholder.
    // The hash does not identify a legacy password account reliably, so only
    // the versioned password hash is positive proof for a Google-linked user.
    // Ambiguous legacy hashes must use the verified recovery flow to enable it.
    await queryRunner.query(`UPDATE "users"
      SET "password_authentication_enabled" = false
      WHERE "google_id" IS NOT NULL AND btrim("google_id") <> ''
        AND "password" NOT LIKE 'ohealth$bcrypt-sha256$v1$%'`);
    await queryRunner.query(`ALTER TABLE "external_identities"
      ADD "last_authenticated_at" TIMESTAMP WITH TIME ZONE`);
    await queryRunner.query(`ALTER TABLE "external_identities"
      ADD CONSTRAINT "CHK_external_identities_issuer"
      CHECK ("issuer" = 'https://accounts.google.com')`);
    await queryRunner.query(`ALTER TABLE "oauth_transactions"
      ADD "session_id" character varying`);
    await queryRunner.query(`ALTER TABLE "oauth_transactions"
      ADD CONSTRAINT "FK_oauth_transactions_session_id"
      FOREIGN KEY ("session_id") REFERENCES "auth_sessions"("session_id") ON DELETE CASCADE`);
    await queryRunner.query(`ALTER TABLE "oauth_transactions"
      DROP CONSTRAINT "CHK_oauth_transactions_signup_binding"`);
    await queryRunner.query(`ALTER TABLE "oauth_transactions"
      ADD CONSTRAINT "CHK_oauth_transactions_signup_binding" CHECK (
        ("operation" = 'signup' AND "intent" IN ('patient', 'healthcare_professional') AND "accepted_terms_version" IS NOT NULL AND "accepted_privacy_version" IS NOT NULL AND "user_id" IS NULL AND "session_id" IS NULL)
        OR ("operation" = 'signin' AND "intent" IS NULL AND "accepted_terms_version" IS NULL AND "accepted_privacy_version" IS NULL AND "user_id" IS NULL AND "session_id" IS NULL)
        OR ("operation" = 'link' AND "intent" IS NULL AND "accepted_terms_version" IS NULL AND "accepted_privacy_version" IS NULL AND "user_id" IS NOT NULL AND "session_id" IS NOT NULL)
      )`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "oauth_transactions" DROP CONSTRAINT "CHK_oauth_transactions_signup_binding"`,
    );
    await queryRunner.query(`ALTER TABLE "oauth_transactions" ADD CONSTRAINT "CHK_oauth_transactions_signup_binding" CHECK (
      ("operation" = 'signup' AND "intent" IN ('patient', 'healthcare_professional') AND "accepted_terms_version" IS NOT NULL AND "accepted_privacy_version" IS NOT NULL AND "user_id" IS NULL)
      OR ("operation" = 'signin' AND "intent" IS NULL AND "accepted_terms_version" IS NULL AND "accepted_privacy_version" IS NULL AND "user_id" IS NULL)
      OR ("operation" = 'link' AND "intent" IS NULL AND "accepted_terms_version" IS NULL AND "accepted_privacy_version" IS NULL AND "user_id" IS NOT NULL)
    )`);
    await queryRunner.query(
      `ALTER TABLE "oauth_transactions" DROP CONSTRAINT "FK_oauth_transactions_session_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "oauth_transactions" DROP COLUMN "session_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "external_identities" DROP CONSTRAINT "CHK_external_identities_issuer"`,
    );
    await queryRunner.query(
      `ALTER TABLE "external_identities" DROP COLUMN "last_authenticated_at"`,
    );
    // Password availability is intentionally not inferred again on rollback.
  }
}
