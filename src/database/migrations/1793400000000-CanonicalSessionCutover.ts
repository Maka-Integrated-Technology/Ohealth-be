import { MigrationInterface, QueryRunner } from 'typeorm';

/** Legacy refresh JWTs cannot become canonical opaque credentials. Force reauthentication. */
export class CanonicalSessionCutover1793400000000 implements MigrationInterface {
  name = 'CanonicalSessionCutover1793400000000';

  async up(runner: QueryRunner): Promise<void> {
    await runner.query(`UPDATE auth_sessions SET revoked_at = COALESCE(revoked_at, now())
      WHERE credential_version = 1`);
  }

  async down(): Promise<void> {
    // Deliberately never restore revoked credentials on a code rollback.
  }
}
