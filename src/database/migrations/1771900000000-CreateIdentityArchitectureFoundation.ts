import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateIdentityArchitectureFoundation1771900000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
        ADD COLUMN "account_status" character varying NOT NULL DEFAULT 'pending_verification',
        ADD COLUMN "email_verified_at" TIMESTAMP WITH TIME ZONE,
        ADD CONSTRAINT "CHK_users_account_status"
          CHECK ("account_status" IN ('pending_verification', 'active', 'suspended', 'deactivated'));
    `);

    await queryRunner.query(`
      UPDATE "users"
      SET
        "account_status" = CASE
          WHEN "is_verified" = false THEN 'pending_verification'
          WHEN "is_active" = true THEN 'active'
          ELSE 'suspended'
        END,
        "email_verified_at" = CASE
          WHEN "is_verified" = true THEN "updated_at"
          ELSE NULL
        END;
    `);

    await queryRunner.query(`
      CREATE TABLE "user_personas" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "user_id" uuid NOT NULL,
        "persona_type" character varying NOT NULL,
        "is_active" boolean NOT NULL DEFAULT true,
        CONSTRAINT "PK_user_personas_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_user_personas_user_type" UNIQUE ("user_id", "persona_type"),
        CONSTRAINT "CHK_user_personas_type"
          CHECK ("persona_type" IN ('patient', 'healthcare_professional')),
        CONSTRAINT "FK_user_personas_user_id"
          FOREIGN KEY ("user_id") REFERENCES "users"("id")
          ON DELETE CASCADE ON UPDATE NO ACTION
      );
      CREATE INDEX "IDX_user_personas_user_id"
        ON "user_personas" ("user_id");
    `);

    await queryRunner.query(`
      INSERT INTO "user_personas" ("user_id", "persona_type")
      SELECT "users"."id", 'patient'
      FROM "users"
      WHERE
        EXISTS (
          SELECT 1 FROM "patient_profiles"
          WHERE "patient_profiles"."user_id" = "users"."id"
        )
        OR 'PATIENT' = ANY(string_to_array("users"."role", ','))
      ON CONFLICT ("user_id", "persona_type") DO NOTHING;
    `);

    await queryRunner.query(`
      INSERT INTO "user_personas" ("user_id", "persona_type")
      SELECT "users"."id", 'healthcare_professional'
      FROM "users"
      WHERE
        EXISTS (
          SELECT 1 FROM "professionals"
          WHERE "professionals"."user_id" = "users"."id"
        )
        OR string_to_array("users"."role", ',') && ARRAY[
          'DOCTOR',
          'THERAPIST',
          'COUNSELLOR',
          'LAB_PROFESSIONAL'
        ]::text[]
      ON CONFLICT ("user_id", "persona_type") DO NOTHING;
    `);

    await queryRunner.query(`
      CREATE TABLE "organization_memberships" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "organization_id" uuid NOT NULL,
        "user_id" uuid NOT NULL,
        "role" character varying NOT NULL,
        "status" character varying NOT NULL DEFAULT 'active',
        "permission_overrides" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "invited_by_user_id" uuid,
        "joined_at" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "PK_organization_memberships_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_organization_memberships_organization_user"
          UNIQUE ("organization_id", "user_id"),
        CONSTRAINT "CHK_organization_memberships_role"
          CHECK ("role" IN ('owner', 'admin', 'member')),
        CONSTRAINT "CHK_organization_memberships_status"
          CHECK ("status" IN ('invited', 'active', 'suspended', 'removed')),
        CONSTRAINT "CHK_organization_memberships_permissions"
          CHECK (jsonb_typeof("permission_overrides") = 'array'),
        CONSTRAINT "FK_organization_memberships_organization_id"
          FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
          ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "FK_organization_memberships_user_id"
          FOREIGN KEY ("user_id") REFERENCES "users"("id")
          ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "FK_organization_memberships_invited_by"
          FOREIGN KEY ("invited_by_user_id") REFERENCES "users"("id")
          ON DELETE SET NULL ON UPDATE NO ACTION
      );
      CREATE INDEX "IDX_organization_memberships_user_id"
        ON "organization_memberships" ("user_id");
      CREATE INDEX "IDX_organization_memberships_organization_id"
        ON "organization_memberships" ("organization_id");
    `);

    await queryRunner.query(`
      INSERT INTO "organization_memberships" (
        "organization_id",
        "user_id",
        "role",
        "status",
        "joined_at"
      )
      SELECT
        "organization_id",
        "user_id",
        CASE WHEN "is_primary" = true THEN 'owner' ELSE 'admin' END,
        'active',
        "created_at"
      FROM "organization_admins"
      ON CONFLICT ("organization_id", "user_id") DO NOTHING;
    `);

    await queryRunner.query(`
      CREATE TABLE "legal_acceptances" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "user_id" uuid NOT NULL,
        "document_type" character varying NOT NULL,
        "document_version" character varying NOT NULL,
        "accepted_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        "ip_address" inet,
        "user_agent" text,
        CONSTRAINT "PK_legal_acceptances_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_legal_acceptances_user_document_version"
          UNIQUE ("user_id", "document_type", "document_version"),
        CONSTRAINT "CHK_legal_acceptances_document_type"
          CHECK ("document_type" IN ('terms_of_service', 'privacy_policy')),
        CONSTRAINT "FK_legal_acceptances_user_id"
          FOREIGN KEY ("user_id") REFERENCES "users"("id")
          ON DELETE CASCADE ON UPDATE NO ACTION
      );
      CREATE INDEX "IDX_legal_acceptances_user_id"
        ON "legal_acceptances" ("user_id");
    `);

    await queryRunner.query(`
      CREATE TABLE "outbox_events" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "aggregate_type" character varying NOT NULL,
        "aggregate_id" uuid,
        "event_type" character varying NOT NULL,
        "payload" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "status" character varying NOT NULL DEFAULT 'pending',
        "attempts" integer NOT NULL DEFAULT 0,
        "available_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "processed_at" TIMESTAMP WITH TIME ZONE,
        "last_error" text,
        CONSTRAINT "PK_outbox_events_id" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_outbox_events_status"
          CHECK ("status" IN ('pending', 'processing', 'published', 'failed')),
        CONSTRAINT "CHK_outbox_events_attempts"
          CHECK ("attempts" >= 0),
        CONSTRAINT "CHK_outbox_events_payload"
          CHECK (jsonb_typeof("payload") = 'object')
      );
      CREATE INDEX "IDX_outbox_events_dispatch"
        ON "outbox_events" ("status", "available_at");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS "outbox_events";');
    await queryRunner.query('DROP TABLE IF EXISTS "legal_acceptances";');
    await queryRunner.query('DROP TABLE IF EXISTS "organization_memberships";');
    await queryRunner.query('DROP TABLE IF EXISTS "user_personas";');
    await queryRunner.query(`
      ALTER TABLE "users"
        DROP CONSTRAINT IF EXISTS "CHK_users_account_status",
        DROP COLUMN IF EXISTS "email_verified_at",
        DROP COLUMN IF EXISTS "account_status";
    `);
  }
}
