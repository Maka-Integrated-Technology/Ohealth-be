import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateLaboratoryPostApprovalSetup1771600000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "laboratory_operating_hours" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "organization_id" uuid NOT NULL,
        "day_of_week" character varying NOT NULL,
        "opens_at" TIME,
        "closes_at" TIME,
        "is_closed" boolean NOT NULL DEFAULT false,
        CONSTRAINT "PK_laboratory_operating_hours_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_laboratory_operating_hours_organization_day"
          UNIQUE ("organization_id", "day_of_week"),
        CONSTRAINT "CHK_laboratory_operating_hours_day"
          CHECK ("day_of_week" IN ('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday')),
        CONSTRAINT "CHK_laboratory_operating_hours_schedule"
          CHECK (
            ("is_closed" = true AND "opens_at" IS NULL AND "closes_at" IS NULL)
            OR
            ("is_closed" = false AND "opens_at" IS NOT NULL AND "closes_at" IS NOT NULL AND "opens_at" < "closes_at")
          ),
        CONSTRAINT "FK_laboratory_operating_hours_organization_id"
          FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
          ON DELETE CASCADE ON UPDATE NO ACTION
      );
      CREATE INDEX "IDX_laboratory_operating_hours_organization_id"
        ON "laboratory_operating_hours" ("organization_id");
    `);

    await queryRunner.query(`
      CREATE TABLE "laboratory_tests" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "organization_id" uuid NOT NULL,
        "name" character varying NOT NULL,
        "normalized_name" character varying NOT NULL,
        "price" numeric(12,2) NOT NULL,
        "turnaround_time_minutes" integer NOT NULL,
        "is_active" boolean NOT NULL DEFAULT true,
        CONSTRAINT "PK_laboratory_tests_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_laboratory_tests_organization_normalized_name"
          UNIQUE ("organization_id", "normalized_name"),
        CONSTRAINT "CHK_laboratory_tests_price" CHECK ("price" >= 0),
        CONSTRAINT "CHK_laboratory_tests_turnaround_time"
          CHECK ("turnaround_time_minutes" > 0),
        CONSTRAINT "FK_laboratory_tests_organization_id"
          FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
          ON DELETE CASCADE ON UPDATE NO ACTION
      );
      CREATE INDEX "IDX_laboratory_tests_organization_id"
        ON "laboratory_tests" ("organization_id");
    `);

    await queryRunner.query(`
      CREATE TABLE "laboratory_staff" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "organization_id" uuid NOT NULL,
        "user_id" uuid,
        "invited_by_user_id" uuid NOT NULL,
        "full_name" character varying NOT NULL,
        "email" character varying NOT NULL,
        "role" character varying NOT NULL,
        "status" character varying NOT NULL DEFAULT 'invited',
        "invitation_token_hash" character(64),
        "invitation_expires_at" TIMESTAMP WITH TIME ZONE,
        "accepted_at" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "PK_laboratory_staff_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_laboratory_staff_organization_email"
          UNIQUE ("organization_id", "email"),
        CONSTRAINT "UQ_laboratory_staff_user_id" UNIQUE ("user_id"),
        CONSTRAINT "UQ_laboratory_staff_invitation_token_hash"
          UNIQUE ("invitation_token_hash"),
        CONSTRAINT "CHK_laboratory_staff_role"
          CHECK ("role" IN ('manager', 'scientist', 'technician', 'phlebotomist', 'receptionist')),
        CONSTRAINT "CHK_laboratory_staff_status"
          CHECK ("status" IN ('invited', 'active')),
        CONSTRAINT "CHK_laboratory_staff_invitation_lifecycle"
          CHECK (
            ("status" = 'invited' AND "user_id" IS NULL AND "invitation_token_hash" IS NOT NULL AND "invitation_expires_at" IS NOT NULL AND "accepted_at" IS NULL)
            OR
            ("status" = 'active' AND "user_id" IS NOT NULL AND "invitation_token_hash" IS NULL AND "invitation_expires_at" IS NULL AND "accepted_at" IS NOT NULL)
          ),
        CONSTRAINT "FK_laboratory_staff_organization_id"
          FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
          ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "FK_laboratory_staff_user_id"
          FOREIGN KEY ("user_id") REFERENCES "users"("id")
          ON DELETE RESTRICT ON UPDATE NO ACTION,
        CONSTRAINT "FK_laboratory_staff_invited_by_user_id"
          FOREIGN KEY ("invited_by_user_id") REFERENCES "users"("id")
          ON DELETE RESTRICT ON UPDATE NO ACTION
      );
      CREATE INDEX "IDX_laboratory_staff_organization_id"
        ON "laboratory_staff" ("organization_id");
      CREATE INDEX "IDX_laboratory_staff_status"
        ON "laboratory_staff" ("status");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE "laboratory_staff";');
    await queryRunner.query('DROP TABLE "laboratory_tests";');
    await queryRunner.query('DROP TABLE "laboratory_operating_hours";');
  }
}
