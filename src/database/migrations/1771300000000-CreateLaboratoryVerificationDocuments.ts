import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateLaboratoryVerificationDocuments1771300000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "laboratory_verification_documents" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "laboratory_id" uuid NOT NULL,
        "document_type" character varying NOT NULL,
        "bucket" character varying NOT NULL,
        "storage_key" character varying NOT NULL,
        "original_filename" character varying NOT NULL,
        "mime_type" character varying NOT NULL,
        "file_size" integer NOT NULL,
        "uploaded_by_user_id" uuid NOT NULL,
        CONSTRAINT "PK_laboratory_verification_documents_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_laboratory_verification_documents_lab_type" UNIQUE ("laboratory_id", "document_type"),
        CONSTRAINT "CHK_laboratory_verification_documents_type" CHECK ("document_type" IN ('laboratory_license', 'accreditation_certificate', 'cac_registration', 'identity_verification')),
        CONSTRAINT "FK_laboratory_verification_documents_laboratory_id" FOREIGN KEY ("laboratory_id") REFERENCES "laboratories"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "FK_laboratory_verification_documents_uploaded_by" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
      );
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_laboratory_verification_documents_laboratory_id"
        ON "laboratory_verification_documents" ("laboratory_id");
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_laboratory_verification_documents_type"
        ON "laboratory_verification_documents" ("document_type");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_laboratory_verification_documents_type";
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_laboratory_verification_documents_laboratory_id";
    `);

    await queryRunner.query(`
      DROP TABLE IF EXISTS "laboratory_verification_documents";
    `);
  }
}
