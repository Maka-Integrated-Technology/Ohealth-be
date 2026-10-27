import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Additive, encrypted-at-rest recovery envelope for challenge delivery.
 * Account email remains in users; no plaintext code or address is copied here.
 * Envelope bytes are destroyed after acceptance, expiry, or final failure.
 */
export class DurableAuthChallengeDelivery1793005000000 implements MigrationInterface {
  name = 'DurableAuthChallengeDelivery1793005000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'CREATE TABLE "auth_challenge_deliveries" (' +
        '"challenge_id" uuid PRIMARY KEY REFERENCES "auth_challenges"("id") ON DELETE CASCADE, ' +
        '"iv" varchar(24), "ciphertext" text, "tag" varchar(32), ' +
        '"status" varchar NOT NULL DEFAULT \'pending\', ' +
        '"attempts" integer NOT NULL DEFAULT 0, ' +
        '"available_at" timestamptz NOT NULL DEFAULT now(), ' +
        '"created_at" timestamptz NOT NULL DEFAULT now(), ' +
        '"accepted_at" timestamptz, ' +
        'CONSTRAINT "CHK_auth_delivery_status" CHECK ' +
        '("status" IN (\'pending\', \'accepted\', \'discarded\')), ' +
        'CONSTRAINT "CHK_auth_delivery_attempts" CHECK ("attempts" >= 0 AND "attempts" <= 5), ' +
        'CONSTRAINT "CHK_auth_delivery_secret" CHECK ' +
        '((status = \'pending\' AND iv IS NOT NULL AND ciphertext IS NOT NULL AND tag IS NOT NULL) OR ' +
        '(status <> \'pending\' AND iv IS NULL AND ciphertext IS NULL AND tag IS NULL))' +
        ')',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_auth_delivery_pending" ON "auth_challenge_deliveries" ' +
        '("available_at", "created_at") WHERE "status" = \'pending\'',
    );
  }

  public async down(): Promise<void> {
    throw new Error(
      'Challenge delivery evidence requires an explicitly reviewed rollback.',
    );
  }
}
