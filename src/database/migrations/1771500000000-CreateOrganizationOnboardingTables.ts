import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateOrganizationOnboardingTables1771500000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "organizations" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "organization_type" character varying NOT NULL,
        "name" character varying NOT NULL,
        "registration_number" character varying NOT NULL,
        "location" text NOT NULL,
        "contact_email" character varying NOT NULL,
        "contact_phone" character varying,
        "verification_status" character varying NOT NULL DEFAULT 'pending',
        "rejection_reason" text,
        "is_active" boolean NOT NULL DEFAULT true,
        CONSTRAINT "PK_organizations_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_organizations_registration_number"
          UNIQUE ("registration_number"),
        CONSTRAINT "CHK_organizations_type"
          CHECK ("organization_type" IN ('hospital', 'laboratory', 'pharmacy')),
        CONSTRAINT "CHK_organizations_verification_status"
          CHECK ("verification_status" IN ('pending', 'submitted', 'under_review', 'approved', 'rejected')),
        CONSTRAINT "CHK_organizations_rejection_reason"
          CHECK ("verification_status" <> 'rejected' OR NULLIF(BTRIM("rejection_reason"), '') IS NOT NULL)
      );
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_organizations_type"
        ON "organizations" ("organization_type");
      CREATE INDEX "IDX_organizations_verification_status"
        ON "organizations" ("verification_status");
    `);

    await queryRunner.query(`
      CREATE TABLE "organization_admins" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "organization_id" uuid NOT NULL,
        "user_id" uuid NOT NULL,
        "full_name" character varying NOT NULL,
        "phone" character varying NOT NULL,
        "is_primary" boolean NOT NULL DEFAULT true,
        CONSTRAINT "PK_organization_admins_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_organization_admins_user_id" UNIQUE ("user_id"),
        CONSTRAINT "UQ_organization_admins_organization_user"
          UNIQUE ("organization_id", "user_id"),
        CONSTRAINT "FK_organization_admins_organization_id"
          FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
          ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "FK_organization_admins_user_id"
          FOREIGN KEY ("user_id") REFERENCES "users"("id")
          ON DELETE RESTRICT ON UPDATE NO ACTION
      );
      CREATE INDEX "IDX_organization_admins_organization_id"
        ON "organization_admins" ("organization_id");
    `);

    await queryRunner.query(`
      CREATE TABLE "organization_documents" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "organization_id" uuid NOT NULL,
        "document_type" character varying NOT NULL,
        "bucket" character varying NOT NULL,
        "storage_key" character varying NOT NULL,
        "original_filename" character varying NOT NULL,
        "mime_type" character varying NOT NULL,
        "file_size" integer NOT NULL,
        "uploaded_by_user_id" uuid NOT NULL,
        CONSTRAINT "PK_organization_documents_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_organization_documents_organization_type"
          UNIQUE ("organization_id", "document_type"),
        CONSTRAINT "CHK_organization_documents_type"
          CHECK ("document_type" IN ('operating_license', 'business_registration', 'accreditation_certificate', 'admin_identity')),
        CONSTRAINT "FK_organization_documents_organization_id"
          FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
          ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "FK_organization_documents_uploaded_by"
          FOREIGN KEY ("uploaded_by_user_id") REFERENCES "users"("id")
          ON DELETE RESTRICT ON UPDATE NO ACTION
      );
      CREATE INDEX "IDX_organization_documents_organization_id"
        ON "organization_documents" ("organization_id");
    `);

    await queryRunner.query(`
      CREATE TABLE "organization_status_history" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "organization_id" uuid NOT NULL,
        "previous_status" character varying,
        "new_status" character varying NOT NULL,
        "reason" text,
        "changed_by_user_id" uuid NOT NULL,
        CONSTRAINT "PK_organization_status_history_id" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_organization_status_history_previous"
          CHECK ("previous_status" IS NULL OR "previous_status" IN ('pending', 'submitted', 'under_review', 'approved', 'rejected')),
        CONSTRAINT "CHK_organization_status_history_new"
          CHECK ("new_status" IN ('pending', 'submitted', 'under_review', 'approved', 'rejected')),
        CONSTRAINT "FK_organization_status_history_organization_id"
          FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
          ON DELETE RESTRICT ON UPDATE NO ACTION,
        CONSTRAINT "FK_organization_status_history_changed_by"
          FOREIGN KEY ("changed_by_user_id") REFERENCES "users"("id")
          ON DELETE RESTRICT ON UPDATE NO ACTION
      );
      CREATE INDEX "IDX_organization_status_history_organization_id"
        ON "organization_status_history" ("organization_id");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE "organization_status_history";');
    await queryRunner.query('DROP TABLE "organization_documents";');
    await queryRunner.query('DROP TABLE "organization_admins";');
    await queryRunner.query('DROP TABLE "organizations";');
  }
}
