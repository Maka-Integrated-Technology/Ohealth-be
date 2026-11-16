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
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
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
