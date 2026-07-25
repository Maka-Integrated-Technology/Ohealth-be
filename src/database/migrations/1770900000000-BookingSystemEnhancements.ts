import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * BookingSystemEnhancements
 *
 * Changes applied:
 *  1. professionals   – unique index on user_id (one profile per user)
 *  2. professionals   – index on speciality_id
 *  3. professional_availabilities – unique composite on (professional_id, date, start_time)
 *  4. professional_availabilities – index on (professional_id, date, start_time)
 *  5. bookings        – nullable availability_id FK (links booked slot for restore-on-cancel)
 *  6. bookings        – index on (professional_id, booking_date, booking_time)
 *  7. professional_reviews table  – new
 */
export class BookingSystemEnhancements1770900000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── 1. Unique index: one professional profile per user ─────────────────
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_professionals_user_id"
        ON "professionals" ("user_id");
    `);

    // ── 2. Index professionals by speciality ──────────────────────────────
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_professionals_speciality_id"
        ON "professionals" ("speciality_id");
    `);

    // ── 3. Unique composite: no duplicate slots for same professional/date/time
    await queryRunner.query(`
      ALTER TABLE "professional_availabilities"
        ADD CONSTRAINT "UQ_prof_avail_professional_date_start"
        UNIQUE ("professional_id", "date", "start_time");
    `);

    // ── 4. Index for fast slot lookup during booking ───────────────────────
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_prof_avail_professional_date_start"
        ON "professional_availabilities" ("professional_id", "date", "start_time");
    `);

    // ── 5. Add availability_id FK to bookings (nullable, backward compatible)
    await queryRunner.query(`
      ALTER TABLE "bookings"
        ADD COLUMN IF NOT EXISTS "availability_id" uuid,
        ADD CONSTRAINT "FK_bookings_availability_id"
          FOREIGN KEY ("availability_id")
          REFERENCES "professional_availabilities"("id")
          ON DELETE SET NULL ON UPDATE NO ACTION;
    `);

    // ── 6. Index bookings for duplicate-slot detection ────────────────────
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_bookings_professional_date_time"
        ON "bookings" ("professional_id", "booking_date", "booking_time");
    `);

    // ── 7. professional_reviews table ────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "professional_reviews" (
        "id"              uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at"      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at"      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "reviewer_id"     uuid NOT NULL,
        "professional_id" uuid NOT NULL,
        "booking_id"      uuid,
        "rating"          smallint NOT NULL,
        "comment"         text,
        CONSTRAINT "PK_professional_reviews_id" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_professional_reviews_rating"
          CHECK ("rating" >= 1 AND "rating" <= 5),
        CONSTRAINT "UQ_professional_reviews_booking_id"
          UNIQUE ("booking_id"),
        CONSTRAINT "FK_professional_reviews_reviewer_id"
          FOREIGN KEY ("reviewer_id") REFERENCES "users"("id")
          ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "FK_professional_reviews_professional_id"
          FOREIGN KEY ("professional_id") REFERENCES "professionals"("id")
          ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "FK_professional_reviews_booking_id"
          FOREIGN KEY ("booking_id") REFERENCES "bookings"("id")
          ON DELETE SET NULL ON UPDATE NO ACTION
      );
    `);

    // Index reviews by professional for fast aggregate queries
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_professional_reviews_professional_id"
        ON "professional_reviews" ("professional_id");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "professional_reviews";`);

    await queryRunner.query(`
      ALTER TABLE "bookings"
        DROP CONSTRAINT IF EXISTS "FK_bookings_availability_id",
        DROP COLUMN IF EXISTS "availability_id";
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_bookings_professional_date_time";
    `);

    await queryRunner.query(`
      ALTER TABLE "professional_availabilities"
        DROP CONSTRAINT IF EXISTS "UQ_prof_avail_professional_date_start";
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_prof_avail_professional_date_start";
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_professionals_speciality_id";
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "UQ_professionals_user_id";
    `);
  }
}
