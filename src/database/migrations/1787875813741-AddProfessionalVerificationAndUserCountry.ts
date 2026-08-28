import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddProfessionalVerificationAndUserCountry1787875813741 implements MigrationInterface {
  name = 'AddProfessionalVerificationAndUserCountry1787875813741';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "professional_verification_documents" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "professional_id" uuid NOT NULL, "document_type" character varying NOT NULL, "bucket" character varying NOT NULL, "storage_key" character varying NOT NULL, "original_filename" character varying NOT NULL, "mime_type" character varying NOT NULL, "file_size" integer NOT NULL, "uploaded_by_user_id" uuid NOT NULL, CONSTRAINT "UQ_b788a26aeeee342b7ae200ccc17" UNIQUE ("professional_id", "document_type"), CONSTRAINT "CHK_professional_verification_documents_type" CHECK ("document_type" IN ('professional_license', 'government_id')), CONSTRAINT "PK_2981c9158fba3ae95eae43d8ce6" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_13c2d2c83d9375153ad7021513" ON "professional_verification_documents" ("document_type") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_082bea25a33a95e5dfcf3ab1c0" ON "professional_verification_documents" ("professional_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "professional_verification_status_history" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "professional_id" uuid NOT NULL, "previous_status" character varying, "new_status" character varying NOT NULL, "reason" text, "changed_by_user_id" uuid NOT NULL, CONSTRAINT "CHK_professional_verification_status_history_new_status" CHECK ("new_status" IN ('pending', 'verified', 'rejected')), CONSTRAINT "CHK_professional_verification_status_history_previous_status" CHECK ("previous_status" IS NULL OR "previous_status" IN ('pending', 'verified', 'rejected')), CONSTRAINT "PK_95a7d80513a12863083700e326a" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_82799031ee7f6eec2168e72f8a" ON "professional_verification_status_history" ("new_status") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_e43962b43ec1cada4b309c8610" ON "professional_verification_status_history" ("professional_id") `,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "country" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "professional_verification_documents" ADD CONSTRAINT "FK_082bea25a33a95e5dfcf3ab1c0e" FOREIGN KEY ("professional_id") REFERENCES "professionals"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "professional_verification_documents" ADD CONSTRAINT "FK_a8289fef2f8461d4aba5368956d" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "professional_verification_status_history" ADD CONSTRAINT "FK_e43962b43ec1cada4b309c8610e" FOREIGN KEY ("professional_id") REFERENCES "professionals"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "professional_verification_status_history" ADD CONSTRAINT "FK_94d71dffefb7b98883990eabf70" FOREIGN KEY ("changed_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "professional_verification_status_history" DROP CONSTRAINT "FK_94d71dffefb7b98883990eabf70"`,
    );
    await queryRunner.query(
      `ALTER TABLE "professional_verification_status_history" DROP CONSTRAINT "FK_e43962b43ec1cada4b309c8610e"`,
    );
    await queryRunner.query(
      `ALTER TABLE "professional_verification_documents" DROP CONSTRAINT "FK_a8289fef2f8461d4aba5368956d"`,
    );
    await queryRunner.query(
      `ALTER TABLE "professional_verification_documents" DROP CONSTRAINT "FK_082bea25a33a95e5dfcf3ab1c0e"`,
    );
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "country"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_e43962b43ec1cada4b309c8610"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_82799031ee7f6eec2168e72f8a"`,
    );
    await queryRunner.query(
      `DROP TABLE "professional_verification_status_history"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_082bea25a33a95e5dfcf3ab1c0"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_13c2d2c83d9375153ad7021513"`,
    );
    await queryRunner.query(`DROP TABLE "professional_verification_documents"`);
  }
}
