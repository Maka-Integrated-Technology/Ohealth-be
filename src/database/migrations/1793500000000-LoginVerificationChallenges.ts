import { MigrationInterface, QueryRunner } from 'typeorm';

/** Adds the purpose-bound pre-session proof required by password login. */
export class LoginVerificationChallenges1793500000000 implements MigrationInterface {
  name = 'LoginVerificationChallenges1793500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "auth_challenges" DROP CONSTRAINT "CHK_auth_challenge_purpose"',
    );
    await queryRunner.query(
      'ALTER TABLE "auth_challenges" ADD CONSTRAINT "CHK_auth_challenge_purpose" ' +
        "CHECK (\"purpose\" IN ('contact_verification', 'password_recovery', 'login_verification'))",
    );
    await queryRunner.query(
      'ALTER TABLE "auth_security_events" DROP CONSTRAINT "CHK_auth_security_events_type"',
    );
    await queryRunner.query(
      'ALTER TABLE "auth_security_events" ADD CONSTRAINT "CHK_auth_security_events_type" ' +
        "CHECK (\"event_type\" IN ('sign_in', 'contact_verification', " +
        "'password_recovery', 'password_change', 'session_refresh', " +
        "'session_reuse', 'logout', 'account_state_change', 'oauth_link', " +
        "'registration', 'mfa', 'login_challenge_request', " +
        "'login_challenge_resend', 'login_challenge_delivery', " +
        "'login_challenge_expiry', 'login_challenge_verification'))",
    );
  }

  public async down(): Promise<void> {
    throw new Error(
      'Login challenge and security-event history require an explicitly reviewed rollback.',
    );
  }
}
