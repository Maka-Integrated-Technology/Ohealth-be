import { MigrationInterface, QueryRunner } from 'typeorm';

/** Never rewrite the already-applied InitialSchema migration. */
export class CanonicalAccountLifecycle1792750000000 implements MigrationInterface {
  name = 'CanonicalAccountLifecycle1792750000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // A previously unknown state is a deployment blocker, not a fallback to ACTIVE.
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM "users"
          WHERE "account_status" IS NULL OR "account_status" NOT IN
            ('pending_verification', 'active', 'suspended', 'deactivated')
        ) THEN
          RAISE EXCEPTION 'Unsupported account_status found during account lifecycle migration';
        END IF;
      END $$
    `);

    await queryRunner.query(`
      CREATE TABLE "user_account_status_history" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "previous_status" varchar,
        "new_status" varchar NOT NULL,
        "changed_by_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
        "reason" text NOT NULL,
        "changed_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "CHK_user_account_history_previous" CHECK
          ("previous_status" IS NULL OR "previous_status" IN
            ('pending_verification', 'active', 'suspended', 'deactivated')),
        CONSTRAINT "CHK_user_account_history_new" CHECK
          ("new_status" IN
            ('pending_verification', 'active', 'suspended', 'deactivated'))
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_account_status_history_user_changed"
        ON "user_account_status_history"("user_id", "changed_at" DESC)
    `);

    // Snapshot prior to reconciliation to create a truthful migration audit.
    await queryRunner.query(`
      CREATE TEMP TABLE "account_status_before_migration" ON COMMIT DROP AS
        SELECT "id", "account_status" FROM "users"
    `);

    // Preserve explicit suspension/deactivation. Historical flags are not
    // proof of mailbox possession; never invent a verification timestamp.
    // An account without recorded proof remains pending until email verification.
    await queryRunner.query(`
      UPDATE "users" SET
        "account_status" = CASE
          WHEN "account_status" IN ('suspended', 'deactivated')
            THEN "account_status"
          WHEN "is_verified" = true AND "email_verified_at" IS NOT NULL
            AND "is_active" = true THEN 'active'
          WHEN "is_verified" = true AND "email_verified_at" IS NOT NULL
            AND "is_active" = false THEN 'deactivated'
          ELSE 'pending_verification'
        END,
        "email_verified_at" = CASE
          WHEN "is_verified" = true THEN "email_verified_at"
          ELSE NULL
        END
    `);
    await queryRunner.query(`
      UPDATE "users" SET
        "is_active" = ("account_status" = 'active'),
        "is_verified" = ("email_verified_at" IS NOT NULL)
    `);

    await queryRunner.query(`
      INSERT INTO "user_account_status_history"
        ("user_id", "previous_status", "new_status", "reason")
      SELECT u."id", old."account_status", u."account_status",
        'migration: reconcile legacy account flags'
      FROM "users" u
      JOIN "account_status_before_migration" old ON old."id" = u."id"
      WHERE old."account_status" IS DISTINCT FROM u."account_status"
    `);

    // New pending accounts must also default to inactive in the database.
    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "is_active" SET DEFAULT false`,
    );

    // During deprecation, reject application writes that drift the legacy flags.
    await queryRunner.query(`
      ALTER TABLE "users" ADD CONSTRAINT "CHK_users_canonical_account_access"
      CHECK (
        "account_status" IN
          ('pending_verification', 'active', 'suspended', 'deactivated')
        AND "is_active" = ("account_status" = 'active')
        AND "is_verified" = ("email_verified_at" IS NOT NULL)
        AND ("account_status" <> 'active' OR "email_verified_at" IS NOT NULL)
      )
    `);
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    void _queryRunner;
    // Backfilled verification timestamps and lifecycle audit history must not
    // be silently destroyed. A rollback needs an explicit, reviewed migration.
    throw new Error(
      'Canonical account lifecycle migration cannot be safely reversed.',
    );
  }
}
