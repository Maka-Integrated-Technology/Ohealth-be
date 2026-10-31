import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Provider IDs must be globally unique. Fail closed on existing collisions:
 * guessing which user owns a duplicated provider subject enables takeover.
 */
export class UniqueGoogleSubject1793170000000 implements MigrationInterface {
  name = 'UniqueGoogleSubject1793170000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        IF EXISTS (
          SELECT 1 FROM users
          WHERE google_id IS NOT NULL
          GROUP BY google_id
          HAVING count(*) > 1
        ) THEN
          RAISE EXCEPTION 'Duplicate Google subjects require manual security review';
        END IF;
      END $$;
    `);
    await queryRunner.query(
      'CREATE UNIQUE INDEX "UQ_users_google_subject" ON "users" ("google_id") WHERE "google_id" IS NOT NULL',
    );
  }

  public async down(): Promise<void> {
    throw new Error(
      'Provider uniqueness requires explicit security approval before rollback.',
    );
  }
}
