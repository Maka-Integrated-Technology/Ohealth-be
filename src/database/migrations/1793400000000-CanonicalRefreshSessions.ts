import { MigrationInterface, QueryRunner } from 'typeorm';

export class CanonicalRefreshSessions1793400000000 implements MigrationInterface {
  name = 'CanonicalRefreshSessions1793400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "auth_sessions" ADD "credential_version" smallint NOT NULL DEFAULT 1`,
    );
    await queryRunner.query(
      `ALTER TABLE "auth_sessions" ADD "last_used_at" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "auth_sessions" ADD CONSTRAINT "CHK_auth_sessions_credential_version" CHECK ("credential_version" IN (1, 2))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_auth_sessions_user_id" ON "auth_sessions" ("user_id")`,
    );
    await queryRunner.query(
      `CREATE TABLE "auth_refresh_credentials" ("token_hash" character varying(64) NOT NULL, "session_id" character varying NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "consumed_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "CHK_auth_refresh_credentials_hash" CHECK ("token_hash" ~ '^[0-9a-f]{64}$'), CONSTRAINT "PK_auth_refresh_credentials" PRIMARY KEY ("token_hash"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_auth_refresh_credentials_session_id" ON "auth_refresh_credentials" ("session_id")`,
    );
    await queryRunner.query(
      `ALTER TABLE "auth_refresh_credentials" ADD CONSTRAINT "FK_auth_refresh_credentials_session" FOREIGN KEY ("session_id") REFERENCES "auth_sessions"("session_id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );

    // Legacy JWT refresh credentials cannot satisfy opaque rotation semantics.
    await queryRunner.query(
      `UPDATE "auth_sessions" SET "revoked_at" = COALESCE("revoked_at", CURRENT_TIMESTAMP) WHERE "credential_version" = 1`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Deliberately do not resurrect sessions revoked by the cutover.
    await queryRunner.query(
      `UPDATE "auth_sessions" SET "revoked_at" = COALESCE("revoked_at", CURRENT_TIMESTAMP) WHERE "credential_version" = 2`,
    );
    await queryRunner.query(
      `ALTER TABLE "auth_refresh_credentials" DROP CONSTRAINT "FK_auth_refresh_credentials_session"`,
    );
    await queryRunner.query(
      `DROP INDEX "IDX_auth_refresh_credentials_session_id"`,
    );
    await queryRunner.query(`DROP TABLE "auth_refresh_credentials"`);
    await queryRunner.query(`DROP INDEX "IDX_auth_sessions_user_id"`);
    await queryRunner.query(
      `ALTER TABLE "auth_sessions" DROP CONSTRAINT "CHK_auth_sessions_credential_version"`,
    );
    await queryRunner.query(
      `ALTER TABLE "auth_sessions" DROP COLUMN "last_used_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "auth_sessions" DROP COLUMN "credential_version"`,
    );
  }
}
