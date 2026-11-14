import { MigrationInterface, QueryRunner } from 'typeorm';

export class PlatformPrivileges1793900000000 implements MigrationInterface {
  name = 'PlatformPrivileges1793900000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "platform_privileges" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "user_id" uuid NOT NULL,
        "privilege" character varying NOT NULL,
        CONSTRAINT "UQ_platform_privileges_user_privilege" UNIQUE ("user_id", "privilege"),
        CONSTRAINT "CHK_platform_privileges_privilege" CHECK ("privilege" IN ('admin')),
        CONSTRAINT "PK_platform_privileges" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_platform_privileges_user_id"
      ON "platform_privileges" ("user_id")
    `);
    await queryRunner.query(`
      ALTER TABLE "platform_privileges"
      ADD CONSTRAINT "FK_platform_privileges_user_id"
      FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
    `);
    // Existing platform administrators are migrated once from the legacy field.
    // Runtime authorization never reads users.role after this migration.
    await queryRunner.query(`
      INSERT INTO "platform_privileges" ("user_id", "privilege")
      SELECT "id", 'admin'
      FROM "users"
      WHERE (',' || COALESCE("role", '') || ',') LIKE '%,ADMIN,%'
      ON CONFLICT ("user_id", "privilege") DO NOTHING
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "platform_privileges" DROP CONSTRAINT "FK_platform_privileges_user_id"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_platform_privileges_user_id"`,
    );
    await queryRunner.query(`DROP TABLE "platform_privileges"`);
  }
}
