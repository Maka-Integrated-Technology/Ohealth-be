import { MigrationInterface, QueryRunner } from 'typeorm';

export class AuthChallengeContinuation1793700000000 implements MigrationInterface {
  name = 'AuthChallengeContinuation1793700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "auth_challenges"
        ADD COLUMN "lineage_id" uuid,
        ADD COLUMN "replaced_by_challenge_id" uuid NULL,
        ADD COLUMN "terminal_reason" varchar NULL,
        ADD COLUMN "replacement_count" integer NOT NULL DEFAULT 0,
        ADD COLUMN "flow_expires_at" timestamptz
    `);
    await queryRunner.query(`
      UPDATE "auth_challenges"
      SET "lineage_id" = "id",
          "flow_expires_at" = GREATEST("expires_at", "issued_at" + interval '30 minutes'),
          "terminal_reason" = CASE
            WHEN "consumed_at" IS NOT NULL THEN 'legacy_consumed'
            ELSE NULL
          END
    `);
    await queryRunner.query(`
      ALTER TABLE "auth_challenges"
        ALTER COLUMN "lineage_id" SET NOT NULL,
        ALTER COLUMN "flow_expires_at" SET NOT NULL,
        ADD CONSTRAINT "FK_auth_challenges_replacement"
          FOREIGN KEY ("replaced_by_challenge_id") REFERENCES "auth_challenges"("id")
          ON DELETE SET NULL,
        ADD CONSTRAINT "CHK_auth_challenge_terminal_reason" CHECK (
          "terminal_reason" IS NULL OR "terminal_reason" IN (
            'verified', 'superseded', 'attempts_exhausted',
            'administratively_revoked', 'legacy_consumed'
          )
        ),
        ADD CONSTRAINT "CHK_auth_challenge_replacement_count" CHECK (
          "replacement_count" >= 0 AND "replacement_count" <= 5
        ),
        ADD CONSTRAINT "CHK_auth_challenge_flow_expiry" CHECK (
          "flow_expires_at" >= "expires_at"
        )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_auth_challenges_lineage"
        ON "auth_challenges" ("lineage_id", "replacement_count" DESC)
    `);
  }

  public async down(): Promise<void> {
    throw new Error(
      'Challenge lineage and terminal history require an explicitly reviewed rollback.',
    );
  }
}
