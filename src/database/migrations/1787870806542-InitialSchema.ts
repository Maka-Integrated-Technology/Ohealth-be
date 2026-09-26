import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1787870806542 implements MigrationInterface {
  name = 'InitialSchema1787870806542';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
    await queryRunner.query(
      `CREATE TABLE "auth_sessions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "session_id" character varying NOT NULL, "user_id" uuid NOT NULL, "refresh_token_hash" character varying NOT NULL, "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL, "revoked_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "UQ_f4665eb7bdf7003cecde7547798" UNIQUE ("session_id"), CONSTRAINT "PK_641507381f32580e8479efc36cd" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "user_2fa" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "user_id" uuid NOT NULL, "two_fa_secret" character varying NOT NULL, "two_fa_enabled" boolean NOT NULL DEFAULT false, "backup_codes" text array, CONSTRAINT "UQ_ed539980faac14226a05368c4d1" UNIQUE ("user_id"), CONSTRAINT "REL_ed539980faac14226a05368c4d" UNIQUE ("user_id"), CONSTRAINT "PK_63a194aa64b4e2039a535a9aa9e" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "legal_acceptances" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "user_id" uuid NOT NULL, "document_type" character varying NOT NULL, "document_version" character varying NOT NULL, "accepted_at" TIMESTAMP WITH TIME ZONE NOT NULL, "ip_address" inet, "user_agent" text, CONSTRAINT "UQ_legal_acceptances_user_document_version" UNIQUE ("user_id", "document_type", "document_version"), CONSTRAINT "CHK_legal_acceptances_document_type" CHECK ("document_type" IN ('terms_of_service', 'privacy_policy')), CONSTRAINT "PK_80ba27e822e932eceb3b0640983" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_legal_acceptances_user_id" ON "legal_acceptances" ("user_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "user_personas" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "user_id" uuid NOT NULL, "persona_type" character varying NOT NULL, "is_active" boolean NOT NULL DEFAULT true, CONSTRAINT "UQ_user_personas_user_type" UNIQUE ("user_id", "persona_type"), CONSTRAINT "CHK_user_personas_type" CHECK ("persona_type" IN ('patient', 'healthcare_professional')), CONSTRAINT "PK_359105fdd12a9c26a9b138cfc35" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_user_personas_user_id" ON "user_personas" ("user_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "organization_admins" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "organization_id" uuid NOT NULL, "user_id" uuid NOT NULL, "full_name" character varying NOT NULL, "phone" character varying NOT NULL, "is_primary" boolean NOT NULL DEFAULT true, CONSTRAINT "UQ_organization_admins_organization_user" UNIQUE ("organization_id", "user_id"), CONSTRAINT "UQ_organization_admins_user_id" UNIQUE ("user_id"), CONSTRAINT "REL_36fd0c8cafb32489dd25f5f641" UNIQUE ("user_id"), CONSTRAINT "PK_9ea816dc8d3d9513b29f36aff9c" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_organization_admins_organization_id" ON "organization_admins" ("organization_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "organization_status_history" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "organization_id" uuid NOT NULL, "previous_status" character varying, "new_status" character varying NOT NULL, "reason" text, "changed_by_user_id" uuid NOT NULL, CONSTRAINT "CHK_organization_status_history_new" CHECK ("new_status" IN ('pending', 'submitted', 'under_review', 'approved', 'rejected')), CONSTRAINT "CHK_organization_status_history_previous" CHECK ("previous_status" IS NULL OR "previous_status" IN ('pending', 'submitted', 'under_review', 'approved', 'rejected')), CONSTRAINT "PK_aef75a99a0e1965a852b6ed3119" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_organization_status_history_organization_id" ON "organization_status_history" ("organization_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "organizations" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "organization_type" character varying NOT NULL, "name" character varying NOT NULL, "registration_number" character varying NOT NULL, "location" text NOT NULL, "contact_email" character varying NOT NULL, "contact_phone" character varying, "verification_status" character varying NOT NULL DEFAULT 'pending', "rejection_reason" text, "is_active" boolean NOT NULL DEFAULT true, CONSTRAINT "UQ_organizations_registration_number" UNIQUE ("registration_number"), CONSTRAINT "CHK_organizations_rejection_reason" CHECK ("verification_status" <> 'rejected' OR NULLIF(BTRIM("rejection_reason"), '') IS NOT NULL), CONSTRAINT "CHK_organizations_verification_status" CHECK ("verification_status" IN ('pending', 'submitted', 'under_review', 'approved', 'rejected')), CONSTRAINT "CHK_organizations_type" CHECK ("organization_type" IN ('hospital', 'laboratory', 'pharmacy')), CONSTRAINT "PK_6b031fcd0863e3f6b44230163f9" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_organizations_verification_status" ON "organizations" ("verification_status") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_organizations_type" ON "organizations" ("organization_type") `,
    );
    await queryRunner.query(
      `CREATE TABLE "organization_memberships" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "organization_id" uuid NOT NULL, "user_id" uuid NOT NULL, "role" character varying NOT NULL, "status" character varying NOT NULL DEFAULT 'active', "permission_overrides" jsonb NOT NULL DEFAULT '[]'::jsonb, "invited_by_user_id" uuid, "joined_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "UQ_organization_memberships_organization_user" UNIQUE ("organization_id", "user_id"), CONSTRAINT "CHK_organization_memberships_permissions" CHECK (jsonb_typeof("permission_overrides") = 'array'), CONSTRAINT "CHK_organization_memberships_status" CHECK ("status" IN ('invited', 'active', 'suspended', 'removed')), CONSTRAINT "CHK_organization_memberships_role" CHECK ("role" IN ('owner', 'admin', 'member')), CONSTRAINT "PK_cd7be805730a4c778a5f45364af" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_organization_memberships_organization_id" ON "organization_memberships" ("organization_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_organization_memberships_user_id" ON "organization_memberships" ("user_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "email" character varying NOT NULL, "password" character varying NOT NULL, "first_name" character varying NOT NULL, "last_name" character varying NOT NULL, "middle_name" character varying, "gender" character varying, "dob" date, "phone" character varying, "image" character varying, "role" text NOT NULL DEFAULT 'PATIENT', "is_active" boolean NOT NULL DEFAULT true, "is_verified" boolean NOT NULL DEFAULT false, "account_status" character varying NOT NULL DEFAULT 'pending_verification', "email_verified_at" TIMESTAMP WITH TIME ZONE, "verification_code" character varying, "verification_code_expires_at" TIMESTAMP WITH TIME ZONE, "google_id" character varying, "reset_token" character varying, "reset_token_expiry" TIMESTAMP WITH TIME ZONE, CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"), CONSTRAINT "CHK_users_account_status" CHECK ("account_status" IN ('pending_verification', 'active', 'suspended', 'deactivated')), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "professional_availabilities" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "professional_id" uuid NOT NULL, "date" date NOT NULL, "start_time" TIME NOT NULL, "end_time" TIME NOT NULL, "is_available" boolean NOT NULL DEFAULT true, CONSTRAINT "UQ_ebaaeb7501054c0285bba0bcd6f" UNIQUE ("professional_id", "date", "start_time"), CONSTRAINT "PK_9b8c01ba5d173409dd43e9d84ba" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_ebaaeb7501054c0285bba0bcd6" ON "professional_availabilities" ("professional_id", "date", "start_time") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."bookings_consultation_type_enum" AS ENUM('chat', 'video')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."bookings_status_enum" AS ENUM('pending', 'confirmed', 'completed', 'cancelled')`,
    );
    await queryRunner.query(
      `CREATE TABLE "bookings" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "patient_id" uuid NOT NULL, "professional_id" uuid NOT NULL, "booking_date" date NOT NULL, "booking_time" TIME NOT NULL, "consultation_type" "public"."bookings_consultation_type_enum" NOT NULL, "amount" numeric(10,2) NOT NULL, "status" "public"."bookings_status_enum" NOT NULL DEFAULT 'pending', "notes" text, "payment_reference" character varying, "is_paid" boolean NOT NULL DEFAULT false, "availability_id" uuid, CONSTRAINT "REL_7c4a7fb9075e1411f3c20430a9" UNIQUE ("availability_id"), CONSTRAINT "PK_bee6805982cc1e248e94ce94957" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_ae33dd352b7fe4d00306339edb" ON "bookings" ("professional_id", "booking_date", "booking_time") `,
    );
    await queryRunner.query(
      `CREATE TABLE "professional_reviews" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "reviewer_id" uuid NOT NULL, "professional_id" uuid NOT NULL, "booking_id" uuid, "rating" smallint NOT NULL, "comment" text, CONSTRAINT "UQ_1bd6e41805982e2c80e3fffcf94" UNIQUE ("booking_id"), CONSTRAINT "REL_1bd6e41805982e2c80e3fffcf9" UNIQUE ("booking_id"), CONSTRAINT "CHK_b17b3bd8be700b50a5f87eeced" CHECK ("rating" >= 1 AND "rating" <= 5), CONSTRAINT "PK_075835426d96a583d2615861e3a" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_387130eced0ca48887900eb79a" ON "professional_reviews" ("professional_id") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."professionals_consultation_type_enum" AS ENUM('chat', 'video', 'both')`,
    );
    await queryRunner.query(
      `CREATE TABLE "professionals" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "user_id" uuid NOT NULL, "speciality_id" uuid NOT NULL, "image" character varying, "about" text, "license_number" character varying, "years_of_experience" integer NOT NULL DEFAULT '0', "consultation_fee" numeric(10,2) NOT NULL, "rating" numeric(3,2) NOT NULL DEFAULT '0', "total_reviews" integer NOT NULL DEFAULT '0', "consultation_type" "public"."professionals_consultation_type_enum" NOT NULL DEFAULT 'both', "is_available" boolean NOT NULL DEFAULT true, "is_active" boolean NOT NULL DEFAULT true, "verification_status" character varying NOT NULL DEFAULT 'pending', "profile_setup_completed" boolean NOT NULL DEFAULT false, CONSTRAINT "UQ_11ce20e0e9f03ab6ce35e95a615" UNIQUE ("user_id"), CONSTRAINT "REL_11ce20e0e9f03ab6ce35e95a61" UNIQUE ("user_id"), CONSTRAINT "PK_d7dc8473b49fcd938def2799387" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_49afc08f24ea704f1f481af32e" ON "professionals" ("speciality_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "specialities" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "name" character varying NOT NULL, "description" character varying, "icon" character varying, "is_active" boolean NOT NULL DEFAULT true, CONSTRAINT "UQ_8c572d501916d63d118c7a5c6e3" UNIQUE ("name"), CONSTRAINT "PK_bff0e3b630c901aec7557343230" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "professional_patient_notes" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "professional_id" uuid NOT NULL, "patient_id" uuid NOT NULL, "content" text NOT NULL, CONSTRAINT "PK_3a2f0a2e9bb46c2b24826a4f98e" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_711a10d5f17fd7319bd1f8cb42" ON "professional_patient_notes" ("professional_id", "patient_id", "created_at") `,
    );
    await queryRunner.query(
      `CREATE TABLE "outbox_events" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "aggregate_type" character varying NOT NULL, "aggregate_id" uuid, "event_type" character varying NOT NULL, "payload" jsonb NOT NULL DEFAULT '{}'::jsonb, "status" character varying NOT NULL DEFAULT 'pending', "attempts" integer NOT NULL DEFAULT '0', "available_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "processed_at" TIMESTAMP WITH TIME ZONE, "last_error" text, CONSTRAINT "CHK_outbox_events_payload" CHECK (jsonb_typeof("payload") = 'object'), CONSTRAINT "CHK_outbox_events_attempts" CHECK ("attempts" >= 0), CONSTRAINT "CHK_outbox_events_status" CHECK ("status" IN ('pending', 'processing', 'published', 'failed')), CONSTRAINT "PK_6689a16c00d09b8089f6237f1d2" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_outbox_events_dispatch" ON "outbox_events" ("status", "available_at") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."pharmacies_verification_status_enum" AS ENUM('submitted', 'under_review', 'approved', 'rejected')`,
    );
    await queryRunner.query(
      `CREATE TABLE "pharmacies" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "name" character varying NOT NULL, "registration_number" character varying NOT NULL, "license_number" character varying NOT NULL, "business_address" text NOT NULL, "region" character varying NOT NULL, "contact_email" character varying NOT NULL, "contact_phone" character varying NOT NULL, "verification_status" "public"."pharmacies_verification_status_enum" NOT NULL DEFAULT 'submitted', "is_active" boolean NOT NULL DEFAULT true, CONSTRAINT "UQ_2627e3d7e208e4b6570270a2b52" UNIQUE ("license_number"), CONSTRAINT "UQ_78066aef9e9014429dbb2b86452" UNIQUE ("registration_number"), CONSTRAINT "PK_887410330080d3beb73850ebc8f" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_d42ee5ad507d7f25ea2fc1b057" ON "pharmacies" ("verification_status") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_e7ed48a2c890b9411bb6c010a0" ON "pharmacies" ("region") `,
    );
    await queryRunner.query(
      `CREATE TABLE "patient_profiles" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "user_id" uuid NOT NULL, "patient_reference" character varying, "medical_conditions" text, "allergies" text, "blood_group" character varying, "height_cm" integer, "weight_kg" double precision, "genotype" character varying, "emergency_contact_name" character varying, "emergency_contact_phone" character varying, CONSTRAINT "UQ_e296010b9088277148d109ba75a" UNIQUE ("user_id"), CONSTRAINT "REL_e296010b9088277148d109ba75" UNIQUE ("user_id"), CONSTRAINT "PK_7297a6976f065cc75e798674aa8" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_aabb309f29c40c8380def467d5" ON "patient_profiles" ("patient_reference") `,
    );
    await queryRunner.query(
      `CREATE TABLE "organization_documents" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "organization_id" uuid NOT NULL, "document_type" character varying NOT NULL, "bucket" character varying NOT NULL, "storage_key" character varying NOT NULL, "original_filename" character varying NOT NULL, "mime_type" character varying NOT NULL, "file_size" integer NOT NULL, "uploaded_by_user_id" uuid NOT NULL, CONSTRAINT "UQ_organization_documents_organization_type" UNIQUE ("organization_id", "document_type"), CONSTRAINT "CHK_organization_documents_type" CHECK ("document_type" IN ('operating_license', 'business_registration', 'accreditation_certificate', 'admin_identity')), CONSTRAINT "PK_7455629b99d63c33c64386a870d" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_organization_documents_organization_id" ON "organization_documents" ("organization_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "laboratory_admins" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "laboratory_id" uuid NOT NULL, "user_id" uuid NOT NULL, "full_name" character varying NOT NULL, "phone" character varying NOT NULL, "is_primary" boolean NOT NULL DEFAULT true, CONSTRAINT "UQ_7b37c9398cc40934da47605c122" UNIQUE ("laboratory_id", "user_id"), CONSTRAINT "UQ_0074ec07e64550bc675e8d836d2" UNIQUE ("user_id"), CONSTRAINT "REL_0074ec07e64550bc675e8d836d" UNIQUE ("user_id"), CONSTRAINT "PK_e92e90a5175fba0995d421ad753" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_dbe509d0e6e98c1455f7d82975" ON "laboratory_admins" ("laboratory_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "laboratory_verification_status_history" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "laboratory_id" uuid NOT NULL, "previous_status" character varying, "new_status" character varying NOT NULL, "reason" text, "changed_by_user_id" uuid NOT NULL, CONSTRAINT "CHK_laboratory_verification_status_history_new_status" CHECK ("new_status" IN ('pending', 'submitted', 'under_review', 'approved', 'rejected')), CONSTRAINT "CHK_laboratory_verification_status_history_previous_status" CHECK ("previous_status" IS NULL OR "previous_status" IN ('pending', 'submitted', 'under_review', 'approved', 'rejected')), CONSTRAINT "PK_5289eeaa994b4c2ebfca87bfeb8" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_d32427664a3e01fac3411c3dbe" ON "laboratory_verification_status_history" ("new_status") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_572f4f1964c1d410f1bd4c719c" ON "laboratory_verification_status_history" ("laboratory_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "laboratories" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "name" character varying NOT NULL, "registration_number" character varying NOT NULL, "license_number" character varying NOT NULL, "address" text NOT NULL, "region" character varying NOT NULL, "contact_email" character varying NOT NULL, "contact_phone" character varying NOT NULL, "verification_status" character varying NOT NULL DEFAULT 'pending', "verification_rejection_reason" text, "onboarding_status" character varying NOT NULL DEFAULT 'laboratory_created', "is_active" boolean NOT NULL DEFAULT true, CONSTRAINT "UQ_3ebf83bf0979ff480cd36c65392" UNIQUE ("license_number"), CONSTRAINT "UQ_133d5089c8eaa3209fea1b76831" UNIQUE ("registration_number"), CONSTRAINT "CHK_laboratories_verification_rejection_reason" CHECK ("verification_status" <> 'rejected' OR NULLIF(BTRIM("verification_rejection_reason"), '') IS NOT NULL), CONSTRAINT "CHK_laboratories_verification_status" CHECK ("verification_status" IN ('pending', 'submitted', 'under_review', 'approved', 'rejected')), CONSTRAINT "PK_095d956b8c0841845525483188c" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_f84d0aaf3bab5c08811266bfc2" ON "laboratories" ("verification_status") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_197f0d060ea05ce2da17fa1322" ON "laboratories" ("region") `,
    );
    await queryRunner.query(
      `CREATE TABLE "laboratory_verification_documents" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "laboratory_id" uuid NOT NULL, "document_type" character varying NOT NULL, "bucket" character varying NOT NULL, "storage_key" character varying NOT NULL, "original_filename" character varying NOT NULL, "mime_type" character varying NOT NULL, "file_size" integer NOT NULL, "uploaded_by_user_id" uuid NOT NULL, CONSTRAINT "UQ_fa5f8be53ea6a04959ba1667442" UNIQUE ("laboratory_id", "document_type"), CONSTRAINT "CHK_laboratory_verification_documents_type" CHECK ("document_type" IN ('laboratory_license', 'accreditation_certificate', 'cac_registration', 'identity_verification')), CONSTRAINT "PK_9b31caf514bd055d66833d3e3d3" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_61a97d97f5101fe7263d571ac6" ON "laboratory_verification_documents" ("document_type") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_8217386df20b0aefa4d665f3d5" ON "laboratory_verification_documents" ("laboratory_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "laboratory_tests" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "organization_id" uuid NOT NULL, "name" character varying NOT NULL, "normalized_name" character varying NOT NULL, "price" numeric(12,2) NOT NULL, "turnaround_time_minutes" integer NOT NULL, "is_active" boolean NOT NULL DEFAULT true, CONSTRAINT "UQ_laboratory_tests_organization_normalized_name" UNIQUE ("organization_id", "normalized_name"), CONSTRAINT "CHK_laboratory_tests_turnaround_time" CHECK ("turnaround_time_minutes" > 0), CONSTRAINT "CHK_laboratory_tests_price" CHECK ("price" >= 0), CONSTRAINT "PK_8c6230e7c148eeea7b0e3b80bca" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_laboratory_tests_organization_id" ON "laboratory_tests" ("organization_id") `,
    );
    await queryRunner.query(`CREATE TABLE "laboratory_operating_hours" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "organization_id" uuid NOT NULL, "day_of_week" character varying NOT NULL, "opens_at" TIME, "closes_at" TIME, "is_closed" boolean NOT NULL DEFAULT false, CONSTRAINT "UQ_laboratory_operating_hours_organization_day" UNIQUE ("organization_id", "day_of_week"), CONSTRAINT "CHK_laboratory_operating_hours_day" CHECK ("day_of_week" IN ('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday')), CONSTRAINT "CHK_laboratory_operating_hours_schedule" CHECK (("is_closed" = true AND "opens_at" IS NULL AND "closes_at" IS NULL)
    OR
   ("is_closed" = false AND "opens_at" IS NOT NULL AND "closes_at" IS NOT NULL AND "opens_at" < "closes_at")), CONSTRAINT "PK_eed4587f9342113bef5e6b741e1" PRIMARY KEY ("id"))`);
    await queryRunner.query(
      `CREATE INDEX "IDX_laboratory_operating_hours_organization_id" ON "laboratory_operating_hours" ("organization_id") `,
    );
    await queryRunner.query(`CREATE TABLE "laboratory_staff" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "organization_id" uuid NOT NULL, "user_id" uuid, "invited_by_user_id" uuid NOT NULL, "full_name" character varying NOT NULL, "email" character varying NOT NULL, "role" character varying NOT NULL, "status" character varying NOT NULL DEFAULT 'invited', "invitation_token_hash" character(64), "invitation_expires_at" TIMESTAMP WITH TIME ZONE, "accepted_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "UQ_laboratory_staff_invitation_token_hash" UNIQUE ("invitation_token_hash"), CONSTRAINT "UQ_laboratory_staff_user_id" UNIQUE ("user_id"), CONSTRAINT "UQ_laboratory_staff_organization_email" UNIQUE ("organization_id", "email"), CONSTRAINT "CHK_laboratory_staff_status" CHECK ("status" IN ('invited', 'active')), CONSTRAINT "CHK_laboratory_staff_role" CHECK ("role" IN ('manager', 'scientist', 'technician', 'phlebotomist', 'receptionist')), CONSTRAINT "CHK_laboratory_staff_invitation_lifecycle" CHECK (("status" = 'invited' AND "user_id" IS NULL AND "invitation_token_hash" IS NOT NULL AND "invitation_expires_at" IS NOT NULL AND "accepted_at" IS NULL)
    OR
   ("status" = 'active' AND "user_id" IS NOT NULL AND "invitation_token_hash" IS NULL AND "invitation_expires_at" IS NULL AND "accepted_at" IS NOT NULL)), CONSTRAINT "PK_0cd4127d4525686529b95311ef4" PRIMARY KEY ("id"))`);
    await queryRunner.query(
      `CREATE INDEX "IDX_laboratory_staff_status" ON "laboratory_staff" ("status") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_laboratory_staff_organization_id" ON "laboratory_staff" ("organization_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "chats" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "user_id" uuid, CONSTRAINT "PK_0117647b3c4a4e5ff198aeb6206" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "messages" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "sender" character varying NOT NULL, "content" text NOT NULL, "chat_id" uuid, CONSTRAINT "PK_18325f38ae6de43878487eff986" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "auth_sessions" ADD CONSTRAINT "FK_50ccaa6440288a06f0ba693ccc6" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_2fa" ADD CONSTRAINT "FK_ed539980faac14226a05368c4d1" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "legal_acceptances" ADD CONSTRAINT "FK_legal_acceptances_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_personas" ADD CONSTRAINT "FK_user_personas_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "organization_admins" ADD CONSTRAINT "FK_organization_admins_organization_id" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "organization_admins" ADD CONSTRAINT "FK_organization_admins_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "organization_status_history" ADD CONSTRAINT "FK_organization_status_history_organization_id" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "organization_status_history" ADD CONSTRAINT "FK_organization_status_history_changed_by" FOREIGN KEY ("changed_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "organization_memberships" ADD CONSTRAINT "FK_organization_memberships_organization_id" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "organization_memberships" ADD CONSTRAINT "FK_organization_memberships_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "organization_memberships" ADD CONSTRAINT "FK_organization_memberships_invited_by" FOREIGN KEY ("invited_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "professional_availabilities" ADD CONSTRAINT "FK_8387355a3f30b751af33b86418b" FOREIGN KEY ("professional_id") REFERENCES "professionals"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "bookings" ADD CONSTRAINT "FK_94824eac901cfb902526e59f814" FOREIGN KEY ("patient_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "bookings" ADD CONSTRAINT "FK_f37e28b72798e0ce3016d997c71" FOREIGN KEY ("professional_id") REFERENCES "professionals"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "bookings" ADD CONSTRAINT "FK_7c4a7fb9075e1411f3c20430a9c" FOREIGN KEY ("availability_id") REFERENCES "professional_availabilities"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "professional_reviews" ADD CONSTRAINT "FK_5cd6652e973d0c813242f0bebbf" FOREIGN KEY ("reviewer_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "professional_reviews" ADD CONSTRAINT "FK_387130eced0ca48887900eb79ab" FOREIGN KEY ("professional_id") REFERENCES "professionals"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "professional_reviews" ADD CONSTRAINT "FK_1bd6e41805982e2c80e3fffcf94" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "professionals" ADD CONSTRAINT "FK_11ce20e0e9f03ab6ce35e95a615" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "professionals" ADD CONSTRAINT "FK_49afc08f24ea704f1f481af32e2" FOREIGN KEY ("speciality_id") REFERENCES "specialities"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "professional_patient_notes" ADD CONSTRAINT "FK_2dfbd6c52faa91ea6f14984e6d5" FOREIGN KEY ("professional_id") REFERENCES "professionals"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "professional_patient_notes" ADD CONSTRAINT "FK_92efabb80681837154eefa56f99" FOREIGN KEY ("patient_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "patient_profiles" ADD CONSTRAINT "FK_e296010b9088277148d109ba75a" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "organization_documents" ADD CONSTRAINT "FK_organization_documents_organization_id" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "organization_documents" ADD CONSTRAINT "FK_organization_documents_uploaded_by" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "laboratory_admins" ADD CONSTRAINT "FK_dbe509d0e6e98c1455f7d82975f" FOREIGN KEY ("laboratory_id") REFERENCES "laboratories"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "laboratory_admins" ADD CONSTRAINT "FK_0074ec07e64550bc675e8d836d2" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "laboratory_verification_status_history" ADD CONSTRAINT "FK_572f4f1964c1d410f1bd4c719ca" FOREIGN KEY ("laboratory_id") REFERENCES "laboratories"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "laboratory_verification_status_history" ADD CONSTRAINT "FK_f048692ba0777bc83f716fa1ae3" FOREIGN KEY ("changed_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "laboratory_verification_documents" ADD CONSTRAINT "FK_8217386df20b0aefa4d665f3d59" FOREIGN KEY ("laboratory_id") REFERENCES "laboratories"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "laboratory_verification_documents" ADD CONSTRAINT "FK_1f7842d168dee8fce188c95f3ee" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "laboratory_tests" ADD CONSTRAINT "FK_laboratory_tests_organization_id" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "laboratory_operating_hours" ADD CONSTRAINT "FK_laboratory_operating_hours_organization_id" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "laboratory_staff" ADD CONSTRAINT "FK_laboratory_staff_organization_id" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "laboratory_staff" ADD CONSTRAINT "FK_laboratory_staff_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "laboratory_staff" ADD CONSTRAINT "FK_laboratory_staff_invited_by_user_id" FOREIGN KEY ("invited_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "chats" ADD CONSTRAINT "FK_b6c92d818d42e3e298e84d94414" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "messages" ADD CONSTRAINT "FK_7540635fef1922f0b156b9ef74f" FOREIGN KEY ("chat_id") REFERENCES "chats"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "messages" DROP CONSTRAINT "FK_7540635fef1922f0b156b9ef74f"`,
    );
    await queryRunner.query(
      `ALTER TABLE "chats" DROP CONSTRAINT "FK_b6c92d818d42e3e298e84d94414"`,
    );
    await queryRunner.query(
      `ALTER TABLE "laboratory_staff" DROP CONSTRAINT "FK_laboratory_staff_invited_by_user_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "laboratory_staff" DROP CONSTRAINT "FK_laboratory_staff_user_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "laboratory_staff" DROP CONSTRAINT "FK_laboratory_staff_organization_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "laboratory_operating_hours" DROP CONSTRAINT "FK_laboratory_operating_hours_organization_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "laboratory_tests" DROP CONSTRAINT "FK_laboratory_tests_organization_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "laboratory_verification_documents" DROP CONSTRAINT "FK_1f7842d168dee8fce188c95f3ee"`,
    );
    await queryRunner.query(
      `ALTER TABLE "laboratory_verification_documents" DROP CONSTRAINT "FK_8217386df20b0aefa4d665f3d59"`,
    );
    await queryRunner.query(
      `ALTER TABLE "laboratory_verification_status_history" DROP CONSTRAINT "FK_f048692ba0777bc83f716fa1ae3"`,
    );
    await queryRunner.query(
      `ALTER TABLE "laboratory_verification_status_history" DROP CONSTRAINT "FK_572f4f1964c1d410f1bd4c719ca"`,
    );
    await queryRunner.query(
      `ALTER TABLE "laboratory_admins" DROP CONSTRAINT "FK_0074ec07e64550bc675e8d836d2"`,
    );
    await queryRunner.query(
      `ALTER TABLE "laboratory_admins" DROP CONSTRAINT "FK_dbe509d0e6e98c1455f7d82975f"`,
    );
    await queryRunner.query(
      `ALTER TABLE "organization_documents" DROP CONSTRAINT "FK_organization_documents_uploaded_by"`,
    );
    await queryRunner.query(
      `ALTER TABLE "organization_documents" DROP CONSTRAINT "FK_organization_documents_organization_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "patient_profiles" DROP CONSTRAINT "FK_e296010b9088277148d109ba75a"`,
    );
    await queryRunner.query(
      `ALTER TABLE "professional_patient_notes" DROP CONSTRAINT "FK_92efabb80681837154eefa56f99"`,
    );
    await queryRunner.query(
      `ALTER TABLE "professional_patient_notes" DROP CONSTRAINT "FK_2dfbd6c52faa91ea6f14984e6d5"`,
    );
    await queryRunner.query(
      `ALTER TABLE "professionals" DROP CONSTRAINT "FK_49afc08f24ea704f1f481af32e2"`,
    );
    await queryRunner.query(
      `ALTER TABLE "professionals" DROP CONSTRAINT "FK_11ce20e0e9f03ab6ce35e95a615"`,
    );
    await queryRunner.query(
      `ALTER TABLE "professional_reviews" DROP CONSTRAINT "FK_1bd6e41805982e2c80e3fffcf94"`,
    );
    await queryRunner.query(
      `ALTER TABLE "professional_reviews" DROP CONSTRAINT "FK_387130eced0ca48887900eb79ab"`,
    );
    await queryRunner.query(
      `ALTER TABLE "professional_reviews" DROP CONSTRAINT "FK_5cd6652e973d0c813242f0bebbf"`,
    );
    await queryRunner.query(
      `ALTER TABLE "bookings" DROP CONSTRAINT "FK_7c4a7fb9075e1411f3c20430a9c"`,
    );
    await queryRunner.query(
      `ALTER TABLE "bookings" DROP CONSTRAINT "FK_f37e28b72798e0ce3016d997c71"`,
    );
    await queryRunner.query(
      `ALTER TABLE "bookings" DROP CONSTRAINT "FK_94824eac901cfb902526e59f814"`,
    );
    await queryRunner.query(
      `ALTER TABLE "professional_availabilities" DROP CONSTRAINT "FK_8387355a3f30b751af33b86418b"`,
    );
    await queryRunner.query(
      `ALTER TABLE "organization_memberships" DROP CONSTRAINT "FK_organization_memberships_invited_by"`,
    );
    await queryRunner.query(
      `ALTER TABLE "organization_memberships" DROP CONSTRAINT "FK_organization_memberships_user_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "organization_memberships" DROP CONSTRAINT "FK_organization_memberships_organization_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "organization_status_history" DROP CONSTRAINT "FK_organization_status_history_changed_by"`,
    );
    await queryRunner.query(
      `ALTER TABLE "organization_status_history" DROP CONSTRAINT "FK_organization_status_history_organization_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "organization_admins" DROP CONSTRAINT "FK_organization_admins_user_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "organization_admins" DROP CONSTRAINT "FK_organization_admins_organization_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_personas" DROP CONSTRAINT "FK_user_personas_user_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "legal_acceptances" DROP CONSTRAINT "FK_legal_acceptances_user_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_2fa" DROP CONSTRAINT "FK_ed539980faac14226a05368c4d1"`,
    );
    await queryRunner.query(
      `ALTER TABLE "auth_sessions" DROP CONSTRAINT "FK_50ccaa6440288a06f0ba693ccc6"`,
    );
    await queryRunner.query(`DROP TABLE "messages"`);
    await queryRunner.query(`DROP TABLE "chats"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_laboratory_staff_organization_id"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_laboratory_staff_status"`,
    );
    await queryRunner.query(`DROP TABLE "laboratory_staff"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_laboratory_operating_hours_organization_id"`,
    );
    await queryRunner.query(`DROP TABLE "laboratory_operating_hours"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_laboratory_tests_organization_id"`,
    );
    await queryRunner.query(`DROP TABLE "laboratory_tests"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_8217386df20b0aefa4d665f3d5"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_61a97d97f5101fe7263d571ac6"`,
    );
    await queryRunner.query(`DROP TABLE "laboratory_verification_documents"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_197f0d060ea05ce2da17fa1322"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_f84d0aaf3bab5c08811266bfc2"`,
    );
    await queryRunner.query(`DROP TABLE "laboratories"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_572f4f1964c1d410f1bd4c719c"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_d32427664a3e01fac3411c3dbe"`,
    );
    await queryRunner.query(
      `DROP TABLE "laboratory_verification_status_history"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_dbe509d0e6e98c1455f7d82975"`,
    );
    await queryRunner.query(`DROP TABLE "laboratory_admins"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_organization_documents_organization_id"`,
    );
    await queryRunner.query(`DROP TABLE "organization_documents"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_aabb309f29c40c8380def467d5"`,
    );
    await queryRunner.query(`DROP TABLE "patient_profiles"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_e7ed48a2c890b9411bb6c010a0"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_d42ee5ad507d7f25ea2fc1b057"`,
    );
    await queryRunner.query(`DROP TABLE "pharmacies"`);
    await queryRunner.query(
      `DROP TYPE "public"."pharmacies_verification_status_enum"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_outbox_events_dispatch"`);
    await queryRunner.query(`DROP TABLE "outbox_events"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_711a10d5f17fd7319bd1f8cb42"`,
    );
    await queryRunner.query(`DROP TABLE "professional_patient_notes"`);
    await queryRunner.query(`DROP TABLE "specialities"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_49afc08f24ea704f1f481af32e"`,
    );
    await queryRunner.query(`DROP TABLE "professionals"`);
    await queryRunner.query(
      `DROP TYPE "public"."professionals_consultation_type_enum"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_387130eced0ca48887900eb79a"`,
    );
    await queryRunner.query(`DROP TABLE "professional_reviews"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_ae33dd352b7fe4d00306339edb"`,
    );
    await queryRunner.query(`DROP TABLE "bookings"`);
    await queryRunner.query(`DROP TYPE "public"."bookings_status_enum"`);
    await queryRunner.query(
      `DROP TYPE "public"."bookings_consultation_type_enum"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_ebaaeb7501054c0285bba0bcd6"`,
    );
    await queryRunner.query(`DROP TABLE "professional_availabilities"`);
    await queryRunner.query(`DROP TABLE "users"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_organization_memberships_user_id"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_organization_memberships_organization_id"`,
    );
    await queryRunner.query(`DROP TABLE "organization_memberships"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_organizations_type"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_organizations_verification_status"`,
    );
    await queryRunner.query(`DROP TABLE "organizations"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_organization_status_history_organization_id"`,
    );
    await queryRunner.query(`DROP TABLE "organization_status_history"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_organization_admins_organization_id"`,
    );
    await queryRunner.query(`DROP TABLE "organization_admins"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_user_personas_user_id"`);
    await queryRunner.query(`DROP TABLE "user_personas"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_legal_acceptances_user_id"`,
    );
    await queryRunner.query(`DROP TABLE "legal_acceptances"`);
    await queryRunner.query(`DROP TABLE "user_2fa"`);
    await queryRunner.query(`DROP TABLE "auth_sessions"`);
  }
}
