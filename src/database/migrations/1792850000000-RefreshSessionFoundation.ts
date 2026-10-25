import { MigrationInterface, QueryRunner } from 'typeorm';

export class RefreshSessionFoundation1792850000000 implements MigrationInterface {
  name = 'RefreshSessionFoundation1792850000000';

  async up(runner: QueryRunner): Promise<void> {
    await runner.query(`ALTER TABLE auth_sessions
      ADD COLUMN credential_version integer NOT NULL DEFAULT 1,
      ADD COLUMN last_used_at timestamptz,
      ADD CONSTRAINT "CHK_auth_session_credential_version" CHECK (credential_version IN (1, 2))`);
    await runner.query(`CREATE TABLE auth_refresh_credentials (
      token_hash varchar(64) PRIMARY KEY,
      session_id varchar NOT NULL REFERENCES auth_sessions(session_id) ON DELETE CASCADE,
      created_at timestamptz NOT NULL DEFAULT now(),
      consumed_at timestamptz,
      CONSTRAINT "CHK_refresh_hash" CHECK (token_hash ~ '^[0-9a-f]{64}$')
    )`);
    await runner.query(`CREATE INDEX "IDX_refresh_credentials_session"
      ON auth_refresh_credentials(session_id)`);
    await runner.query(`CREATE INDEX "IDX_auth_sessions_user"
      ON auth_sessions(user_id)`);
  }

  async down(runner: QueryRunner): Promise<void> {
    // A rollback must not resurrect sessions issued by the new implementation.
    await runner.query(`UPDATE auth_sessions SET revoked_at = COALESCE(revoked_at, now())
      WHERE credential_version = 2`);
    await runner.query('DROP TABLE auth_refresh_credentials');
    await runner.query('DROP INDEX "IDX_auth_sessions_user"');
    await runner.query(`ALTER TABLE auth_sessions
      DROP CONSTRAINT "CHK_auth_session_credential_version",
      DROP COLUMN last_used_at, DROP COLUMN credential_version`);
  }
}
