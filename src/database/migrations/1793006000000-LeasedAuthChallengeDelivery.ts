import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Existing pending deliveries survive deployment; processing claims are
 * recoverable after a worker crash. Tokens fence stale workers.
 */
export class LeasedAuthChallengeDelivery1793006000000 implements MigrationInterface {
  name = 'LeasedAuthChallengeDelivery1793006000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "auth_challenge_deliveries" ' +
        'ADD COLUMN "lease_token" uuid, ' +
        'ADD COLUMN "lease_expires_at" timestamptz',
    );
    await queryRunner.query(
      'ALTER TABLE "auth_challenge_deliveries" ' +
        'DROP CONSTRAINT "CHK_auth_delivery_status", ' +
        'DROP CONSTRAINT "CHK_auth_delivery_secret"',
    );
    await queryRunner.query(
      'ALTER TABLE "auth_challenge_deliveries" ' +
        'ADD CONSTRAINT "CHK_auth_delivery_status" CHECK ' +
        "(status IN ('pending', 'processing', 'accepted', 'discarded')), " +
        'ADD CONSTRAINT "CHK_auth_delivery_secret" CHECK ' +
        "((status IN ('pending', 'processing') AND iv IS NOT NULL AND " +
        'ciphertext IS NOT NULL AND tag IS NOT NULL) OR ' +
        "(status IN ('accepted', 'discarded') AND iv IS NULL AND " +
        'ciphertext IS NULL AND tag IS NULL)), ' +
        'ADD CONSTRAINT "CHK_auth_delivery_lease" CHECK ' +
        "((status = 'processing' AND lease_token IS NOT NULL AND " +
        'lease_expires_at IS NOT NULL) OR ' +
        "(status <> 'processing' AND lease_token IS NULL AND lease_expires_at IS NULL))",
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_auth_delivery_expired_lease" ' +
        'ON "auth_challenge_deliveries" ("lease_expires_at") ' +
        "WHERE status = 'processing'",
    );
  }

  public async down(): Promise<void> {
    throw new Error('Review active delivery leases before downgrading schema.');
  }
}
