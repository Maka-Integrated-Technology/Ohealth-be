import { MigrationInterface, QueryRunner } from 'typeorm';

export class EmailChanges1795400000000 implements MigrationInterface {
  name = 'EmailChanges1795400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE auth_challenges DROP CONSTRAINT "CHK_auth_challenge_purpose"`,
    );
    await queryRunner.query(
      `ALTER TABLE auth_challenges ADD CONSTRAINT "CHK_auth_challenge_purpose" CHECK (purpose IN ('contact_verification', 'password_recovery', 'login_verification', 'mfa_login', 'email_change'))`,
    );
    await queryRunner.query(
      `ALTER TABLE auth_security_events DROP CONSTRAINT "CHK_auth_security_events_type"`,
    );
    await queryRunner.query(
      `ALTER TABLE auth_security_events ADD CONSTRAINT "CHK_auth_security_events_type" CHECK (event_type IN ('sign_in', 'contact_verification', 'email_change', 'password_recovery', 'password_change', 'session_refresh', 'session_reuse', 'logout', 'account_state_change', 'oauth_signup', 'oauth_sign_in', 'oauth_link', 'oauth_unlink', 'oauth_conflict', 'oauth_denial', 'registration', 'mfa', 'mfa_enrollment_started', 'mfa_activated', 'mfa_recovery_codes_regenerated', 'mfa_disabled', 'login_challenge_request', 'login_challenge_resend', 'login_challenge_delivery', 'login_challenge_expiry', 'login_challenge_verification', 'context_restoration', 'authorization_denial'))`,
    );
    await queryRunner.query(`CREATE TABLE auth_email_changes (
      lineage_id uuid PRIMARY KEY REFERENCES auth_challenges(id) ON DELETE CASCADE,
      subject_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      destination_hash char(64) NOT NULL,
      destination_iv varchar NOT NULL,
      destination_ciphertext varchar NOT NULL,
      destination_tag varchar NOT NULL,
      deliverable boolean NOT NULL,
      expires_at timestamptz NOT NULL
    )`);
    await queryRunner.query(
      `CREATE INDEX "IDX_auth_email_changes_expiry" ON auth_email_changes (expires_at)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE auth_email_changes`);
    await queryRunner.query(
      `ALTER TABLE auth_security_events DROP CONSTRAINT "CHK_auth_security_events_type"`,
    );
    await queryRunner.query(
      `ALTER TABLE auth_security_events ADD CONSTRAINT "CHK_auth_security_events_type" CHECK (event_type IN ('sign_in', 'contact_verification', 'password_recovery', 'password_change', 'session_refresh', 'session_reuse', 'logout', 'account_state_change', 'oauth_signup', 'oauth_sign_in', 'oauth_link', 'oauth_unlink', 'oauth_conflict', 'oauth_denial', 'registration', 'mfa', 'mfa_enrollment_started', 'mfa_activated', 'mfa_recovery_codes_regenerated', 'mfa_disabled', 'login_challenge_request', 'login_challenge_resend', 'login_challenge_delivery', 'login_challenge_expiry', 'login_challenge_verification', 'context_restoration', 'authorization_denial'))`,
    );
    await queryRunner.query(
      `ALTER TABLE auth_challenges DROP CONSTRAINT "CHK_auth_challenge_purpose"`,
    );
    await queryRunner.query(
      `ALTER TABLE auth_challenges ADD CONSTRAINT "CHK_auth_challenge_purpose" CHECK (purpose IN ('contact_verification', 'password_recovery', 'login_verification', 'mfa_login'))`,
    );
  }
}
