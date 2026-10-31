import { MigrationInterface, QueryRunner } from 'typeorm';

/** Add only the audited OAuth unlink event; preserve immutable prior history. */
export class AddOAuthUnlinkSecurityAudit1793180000000 implements MigrationInterface {
  name = 'AddOAuthUnlinkSecurityAudit1793180000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "auth_security_events" DROP CONSTRAINT "CHK_auth_security_events_type"',
    );
    await queryRunner.query(`
      ALTER TABLE "auth_security_events"
      ADD CONSTRAINT "CHK_auth_security_events_type"
      CHECK ("event_type" IN (
        'sign_in', 'contact_verification', 'password_recovery',
        'password_change', 'session_refresh', 'session_reuse', 'logout',
        'account_state_change', 'oauth_link', 'oauth_unlink',
        'registration', 'mfa'
      ))
    `);
  }

  public async down(): Promise<void> {
    throw new Error(
      'Audited OAuth unlink history cannot be invalidated by rollback.',
    );
  }
}
