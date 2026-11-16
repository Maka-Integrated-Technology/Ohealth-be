import { MigrationInterface, QueryRunner } from 'typeorm';

export class SecureMfa1794000000000 implements MigrationInterface {
  name = 'SecureMfa1794000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Legacy secrets and backup codes were plaintext. Invalidate them before
    // enabling the replacement; accounts must enroll a new factor.
    await queryRunner.query('UPDATE user_2fa SET two_fa_enabled = false');
    await queryRunner.query('ALTER TABLE user_2fa DROP COLUMN two_fa_secret');
    await queryRunner.query('ALTER TABLE user_2fa DROP COLUMN backup_codes');
    await queryRunner.query(
      'ALTER TABLE user_2fa ADD COLUMN encrypted_secret text',
    );
    await queryRunner.query(
      'ALTER TABLE user_2fa ADD COLUMN pending_secret text',
    );
    await queryRunner.query(
      'ALTER TABLE user_2fa ADD COLUMN pending_expires_at timestamptz',
    );
    await queryRunner.query(
      'ALTER TABLE user_2fa ADD COLUMN last_used_step bigint',
    );
    await queryRunner.query(
      'ALTER TABLE user_2fa DROP CONSTRAINT "FK_ed539980faac14226a05368c4d1"',
    );
    await queryRunner.query(
      'ALTER TABLE user_2fa ADD CONSTRAINT "FK_ed539980faac14226a05368c4d1" ' +
        'FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE',
    );
    await queryRunner.query(`CREATE TABLE mfa_recovery_codes (
      id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      code_hash char(64) NOT NULL UNIQUE,
      created_at timestamptz NOT NULL DEFAULT now()
    )`);
    await queryRunner.query(
      'CREATE INDEX IDX_mfa_recovery_user ON mfa_recovery_codes(user_id)',
    );
    await queryRunner.query(
      `ALTER TABLE auth_challenges DROP CONSTRAINT "CHK_auth_challenge_purpose"`,
    );
    await queryRunner.query(
      `ALTER TABLE auth_challenges ADD CONSTRAINT "CHK_auth_challenge_purpose" CHECK (purpose IN ('contact_verification', 'password_recovery', 'login_verification', 'mfa_login'))`,
    );
    await queryRunner.query(
      'ALTER TABLE auth_challenges ADD COLUMN continuation_transport varchar',
    );
    await queryRunner.query(
      `ALTER TABLE auth_challenges ADD CONSTRAINT "CHK_auth_challenge_transport" CHECK (continuation_transport IS NULL OR continuation_transport IN ('web', 'mobile'))`,
    );
    await queryRunner.query(
      `ALTER TABLE auth_security_events DROP CONSTRAINT "CHK_auth_security_events_type"`,
    );
    await queryRunner.query(
      `ALTER TABLE auth_security_events ADD CONSTRAINT "CHK_auth_security_events_type" CHECK (event_type IN ('sign_in', 'contact_verification', 'password_recovery', 'password_change', 'session_refresh', 'session_reuse', 'logout', 'account_state_change', 'oauth_signup', 'oauth_sign_in', 'oauth_link', 'oauth_unlink', 'oauth_conflict', 'oauth_denial', 'registration', 'mfa', 'mfa_enrollment_started', 'mfa_activated', 'mfa_recovery_codes_regenerated', 'mfa_disabled', 'login_challenge_request', 'login_challenge_resend', 'login_challenge_delivery', 'login_challenge_expiry', 'login_challenge_verification'))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE auth_security_events DROP CONSTRAINT "CHK_auth_security_events_type"`,
    );
    await queryRunner.query(
      `ALTER TABLE auth_security_events ADD CONSTRAINT "CHK_auth_security_events_type" CHECK (event_type IN ('sign_in', 'contact_verification', 'password_recovery', 'password_change', 'session_refresh', 'session_reuse', 'logout', 'account_state_change', 'oauth_signup', 'oauth_sign_in', 'oauth_link', 'oauth_unlink', 'oauth_conflict', 'oauth_denial', 'registration', 'mfa', 'login_challenge_request', 'login_challenge_resend', 'login_challenge_delivery', 'login_challenge_expiry', 'login_challenge_verification'))`,
    );
    await queryRunner.query(
      `ALTER TABLE auth_challenges DROP CONSTRAINT "CHK_auth_challenge_transport"`,
    );
    await queryRunner.query(
      'ALTER TABLE auth_challenges DROP COLUMN continuation_transport',
    );
    await queryRunner.query(
      `ALTER TABLE auth_challenges DROP CONSTRAINT "CHK_auth_challenge_purpose"`,
    );
    await queryRunner.query(
      `ALTER TABLE auth_challenges ADD CONSTRAINT "CHK_auth_challenge_purpose" CHECK (purpose IN ('contact_verification', 'password_recovery', 'login_verification'))`,
    );
    await queryRunner.query('DROP TABLE mfa_recovery_codes');
    await queryRunner.query(
      'ALTER TABLE user_2fa DROP CONSTRAINT "FK_ed539980faac14226a05368c4d1"',
    );
    await queryRunner.query(
      'ALTER TABLE user_2fa ADD CONSTRAINT "FK_ed539980faac14226a05368c4d1" ' +
        'FOREIGN KEY (user_id) REFERENCES users(id)',
    );
    await queryRunner.query('ALTER TABLE user_2fa DROP COLUMN last_used_step');
    await queryRunner.query(
      'ALTER TABLE user_2fa DROP COLUMN pending_expires_at',
    );
    await queryRunner.query('ALTER TABLE user_2fa DROP COLUMN pending_secret');
    await queryRunner.query(
      'ALTER TABLE user_2fa DROP COLUMN encrypted_secret',
    );
    await queryRunner.query(
      "ALTER TABLE user_2fa ADD COLUMN two_fa_secret varchar NOT NULL DEFAULT ''",
    );
    await queryRunner.query(
      'ALTER TABLE user_2fa ADD COLUMN backup_codes text[]',
    );
  }
}
