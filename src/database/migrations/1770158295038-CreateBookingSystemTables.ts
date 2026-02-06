import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateBookingSystemTables1770158295038 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "specialities" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "name" character varying NOT NULL,
        "description" text,
        "icon" character varying,
        "is_active" boolean NOT NULL DEFAULT true,
        CONSTRAINT "PK_specialities_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_specialities_name" UNIQUE ("name")
      );
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "professionals" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "user_id" uuid NOT NULL,
        "speciality_id" uuid NOT NULL,
        "image" character varying,
        "about" text,
        "years_of_experience" integer NOT NULL DEFAULT 0,
        "consultation_fee" decimal(10,2) NOT NULL,
        "rating" decimal(3,2) NOT NULL DEFAULT 0,
        "total_reviews" integer NOT NULL DEFAULT 0,
        "consultation_type" character varying NOT NULL DEFAULT 'both',
        "is_available" boolean NOT NULL DEFAULT true,
        "is_active" boolean NOT NULL DEFAULT true,
        CONSTRAINT "PK_professionals_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_professionals_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "FK_professionals_speciality_id" FOREIGN KEY ("speciality_id") REFERENCES "specialities"("id") ON DELETE CASCADE ON UPDATE NO ACTION
      );
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "professional_availabilities" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "professional_id" uuid NOT NULL,
        "date" date NOT NULL,
        "start_time" time NOT NULL,
        "end_time" time NOT NULL,
        "is_available" boolean NOT NULL DEFAULT true,
        CONSTRAINT "PK_professional_availabilities_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_professional_availabilities_professional_id" FOREIGN KEY ("professional_id") REFERENCES "professionals"("id") ON DELETE CASCADE ON UPDATE NO ACTION
      );
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "bookings" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "patient_id" uuid NOT NULL,
        "professional_id" uuid NOT NULL,
        "booking_date" date NOT NULL,
        "booking_time" time NOT NULL,
        "consultation_type" character varying NOT NULL,
        "amount" decimal(10,2) NOT NULL,
        "status" character varying NOT NULL DEFAULT 'pending',
        "notes" text,
        "payment_reference" character varying,
        "is_paid" boolean NOT NULL DEFAULT false,
        CONSTRAINT "PK_bookings_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_bookings_patient_id" FOREIGN KEY ("patient_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "FK_bookings_professional_id" FOREIGN KEY ("professional_id") REFERENCES "professionals"("id") ON DELETE CASCADE ON UPDATE NO ACTION
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS "bookings";');
    await queryRunner.query(
      'DROP TABLE IF EXISTS "professional_availabilities";',
    );
    await queryRunner.query('DROP TABLE IF EXISTS "professionals";');
    await queryRunner.query('DROP TABLE IF EXISTS "specialities";');
  }
}
