import { MigrationInterface, QueryRunner } from 'typeorm';

export class AuthChallengeFoundation1793000000000 implements MigrationInterface {
  name = 'AuthChallengeFoundation1793000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "auth_challenges" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "purpose" varchar NOT NULL,
        "subject_user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "secret_hash" char(64) NOT NULL,
        "issued_at" timestamptz NOT NULL DEFAULT now(),
        "expires_at" timestamptz NOT NULL,
        "attempt_count" integer NOT NULL DEFAULT 0,
        "consumed_at" timestamptz NULL,
        CONSTRAINT "CHK_auth_challenge_purpose" CHECK (
          "purpose" IN ('contact_verification', 'password_recovery')
        ),
        CONSTRAINT "CHK_auth_challenge_attempts" CHECK (
          "attempt_count" >= 0 AND "attempt_count" <= 5
        ),
        CONSTRAINT "CHK_auth_challenge_expiry" CHECK (
          "expires_at" > "issued_at"
        )
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_auth_challenges_active_subject_purpose"
        ON "auth_challenges" ("subject_user_id", "purpose")
        WHERE "consumed_at" IS NULL
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_auth_challenges_subject_issued"
        ON "auth_challenges" ("subject_user_id", "purpose", "issued_at" DESC)
    `);
    await queryRunner.query(`
      CREATE TABLE "auth_rate_limit_buckets" (
        "key_hash" char(64) PRIMARY KEY,
        "hits" integer NOT NULL,
        "window_ends_at" timestamptz NOT NULL,
        CONSTRAINT "CHK_auth_rate_limit_hits" CHECK ("hits" >= 1)
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_auth_rate_limit_expiry"
        ON "auth_rate_limit_buckets" ("window_ends_at")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    void queryRunner;
    throw new Error('Auth challenge history cannot be automatically dropped.');
  }
}
