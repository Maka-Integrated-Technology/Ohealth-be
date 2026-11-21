import { MigrationInterface, QueryRunner } from 'typeorm';

export class ProfilePhotos1795300000000 implements MigrationInterface {
  name = 'ProfilePhotos1795300000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE "profile_photos" (
      "user_id" uuid NOT NULL,
      "object_key" character varying NOT NULL,
      "bucket" character varying NOT NULL,
      "version_id" character varying NOT NULL,
      "content_type" character varying NOT NULL,
      "byte_size" integer NOT NULL,
      "width" integer NOT NULL,
      "height" integer NOT NULL,
      "sha256" character(64) NOT NULL,
      "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
      CONSTRAINT "PK_profile_photos_user" PRIMARY KEY ("user_id"),
      CONSTRAINT "UQ_profile_photos_object_key" UNIQUE ("object_key"),
      CONSTRAINT "FK_profile_photos_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
      CONSTRAINT "CHK_profile_photos_size" CHECK ("byte_size" > 0 AND "width" > 0 AND "height" > 0)
    )`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE "profile_photos"');
  }
}
