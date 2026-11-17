import { MigrationInterface, QueryRunner } from 'typeorm';

export class ActiveBookingPerSlot1794300000000 implements MigrationInterface {
  name = 'ActiveBookingPerSlot1794300000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    // The unique constraint allowed one booking per slot forever, so a slot
    // freed by a cancelled or rejected booking could never be booked again.
    // Only a booking that is not cancelled holds its slot; cancelled bookings
    // keep the link as history.
    await queryRunner.query(`
      ALTER TABLE "bookings" DROP CONSTRAINT "REL_7c4a7fb9075e1411f3c20430a9"
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_bookings_active_availability"
      ON "bookings" ("availability_id")
      WHERE "status" <> 'cancelled'
    `);
    // The dropped constraint also indexed the foreign key, which deleting a
    // slot (ON DELETE SET NULL) searches through cancelled bookings too.
    await queryRunner.query(`
      CREATE INDEX "IDX_bookings_availability_id" ON "bookings" ("availability_id")
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_bookings_availability_id"`);
    await queryRunner.query(`DROP INDEX "UQ_bookings_active_availability"`);
    // The previous constraint allows one booking per slot in total. Where a
    // slot was booked again, the active booking keeps the link, or else the
    // latest one; the others give it up.
    await queryRunner.query(`
      UPDATE "bookings" AS "booking"
      SET "availability_id" = NULL
      FROM (
        SELECT "id", ROW_NUMBER() OVER (
          PARTITION BY "availability_id"
          ORDER BY ("status" <> 'cancelled') DESC, "created_at" DESC, "id" DESC
        ) AS "rank"
        FROM "bookings"
        WHERE "availability_id" IS NOT NULL
      ) AS "ranked"
      WHERE "booking"."id" = "ranked"."id" AND "ranked"."rank" > 1
    `);
    await queryRunner.query(`
      ALTER TABLE "bookings"
      ADD CONSTRAINT "REL_7c4a7fb9075e1411f3c20430a9" UNIQUE ("availability_id")
    `);
  }
}
