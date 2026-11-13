import { MigrationInterface, QueryRunner } from 'typeorm';

export class CanonicalGoogleOAuth1793800000000 implements MigrationInterface {
  name = 'CanonicalGoogleOAuth1793800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD "password_authentication_enabled" boolean NOT NULL DEFAULT true`,
    );
    await queryRunner.query(
      `CREATE TABLE "external_identities" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "provider" character varying NOT NULL,
        "issuer" character varying NOT NULL,
        "subject" character varying NOT NULL,
        "linked_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_external_identities_issuer_subject" UNIQUE ("issuer", "subject"),
        CONSTRAINT "UQ_external_identities_user_provider" UNIQUE ("user_id", "provider"),
        CONSTRAINT "PK_external_identities" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_external_identities_provider" CHECK ("provider" IN ('google')),
        CONSTRAINT "FK_external_identities_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      )`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_external_identities_user_id" ON "external_identities" ("user_id")`,
    );
    // Duplicate subjects deliberately fail the unique constraint and stop rollout.
    await queryRunner.query(
      `INSERT INTO "external_identities" ("user_id", "provider", "issuer", "subject")
       SELECT "id", 'google', 'https://accounts.google.com', btrim("google_id")
       FROM "users"
       WHERE "google_id" IS NOT NULL AND btrim("google_id") <> ''`,
    );

    await queryRunner.query(
      `CREATE TABLE "oauth_transactions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "provider" character varying NOT NULL,
        "operation" character varying NOT NULL,
        "consumer" character varying NOT NULL,
        "audience" character varying NOT NULL,
        "transaction_token_hash" character(64) NOT NULL,
        "nonce_hash" character(64) NOT NULL,
        "intent" character varying,
        "accepted_terms_version" character varying,
        "accepted_privacy_version" character varying,
        "user_id" uuid,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        "consumed_at" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "PK_oauth_transactions" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_oauth_transactions_provider" CHECK ("provider" IN ('google')),
        CONSTRAINT "CHK_oauth_transactions_operation" CHECK ("operation" IN ('signup', 'signin', 'link')),
        CONSTRAINT "CHK_oauth_transactions_consumer" CHECK ("consumer" IN ('web', 'mobile')),
        CONSTRAINT "CHK_oauth_transactions_signup_binding" CHECK (
          ("operation" = 'signup' AND "intent" IN ('patient', 'healthcare_professional') AND "accepted_terms_version" IS NOT NULL AND "accepted_privacy_version" IS NOT NULL AND "user_id" IS NULL)
          OR ("operation" = 'signin' AND "intent" IS NULL AND "accepted_terms_version" IS NULL AND "accepted_privacy_version" IS NULL AND "user_id" IS NULL)
          OR ("operation" = 'link' AND "intent" IS NULL AND "accepted_terms_version" IS NULL AND "accepted_privacy_version" IS NULL AND "user_id" IS NOT NULL)
        ),
        CONSTRAINT "FK_oauth_transactions_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      )`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_oauth_transactions_expiry" ON "oauth_transactions" ("expires_at")`,
    );

    await queryRunner.query(
      `ALTER TABLE "auth_security_events" DROP CONSTRAINT "CHK_auth_security_events_type"`,
    );
    await queryRunner.query(
      `ALTER TABLE "auth_security_events" ADD CONSTRAINT "CHK_auth_security_events_type" CHECK ("event_type" IN ('sign_in', 'contact_verification', 'password_recovery', 'password_change', 'session_refresh', 'session_reuse', 'logout', 'account_state_change', 'oauth_signup', 'oauth_sign_in', 'oauth_link', 'oauth_unlink', 'oauth_conflict', 'oauth_denial', 'registration', 'mfa', 'login_challenge_request', 'login_challenge_resend', 'login_challenge_delivery', 'login_challenge_expiry', 'login_challenge_verification'))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "auth_security_events" DROP CONSTRAINT "CHK_auth_security_events_type"`,
    );
    await queryRunner.query(
      `ALTER TABLE "auth_security_events" ADD CONSTRAINT "CHK_auth_security_events_type" CHECK ("event_type" IN ('sign_in', 'contact_verification', 'password_recovery', 'password_change', 'session_refresh', 'session_reuse', 'logout', 'account_state_change', 'oauth_link', 'registration', 'mfa', 'login_challenge_request', 'login_challenge_resend', 'login_challenge_delivery', 'login_challenge_expiry', 'login_challenge_verification'))`,
    );
    await queryRunner.query(`DROP TABLE "oauth_transactions"`);
    await queryRunner.query(`DROP TABLE "external_identities"`);
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN "password_authentication_enabled"`,
    );
  }
}
