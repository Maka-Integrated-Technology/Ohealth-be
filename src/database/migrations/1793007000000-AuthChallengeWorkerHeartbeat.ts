import { MigrationInterface, QueryRunner } from 'typeorm';

/** Lease-free, aggregate-only proof that a dispatch process is running. */
export class AuthChallengeWorkerHeartbeat1793007000000 implements MigrationInterface {
  name = 'AuthChallengeWorkerHeartbeat1793007000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'CREATE TABLE "auth_challenge_worker_heartbeat" (' +
        '"id" varchar PRIMARY KEY, ' +
        '"last_seen_at" timestamptz NOT NULL, ' +
        '"pending" integer NOT NULL, ' +
        '"oldest_pending_seconds" integer NOT NULL, ' +
        '"expired_leases" integer NOT NULL, ' +
        'CONSTRAINT "CHK_auth_worker_id" CHECK ("id" = \'delivery\')' +
        ')',
    );
  }

  public async down(): Promise<void> {
    throw new Error('Review worker migration rollback explicitly.');
  }
}
