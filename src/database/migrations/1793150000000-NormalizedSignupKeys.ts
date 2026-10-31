import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Non-destructive uniqueness enforcement. Fail deployment on ambiguous legacy
 * accounts/organizations rather than silently selecting or rewriting owners.
 */
export class NormalizedSignupKeys1793150000000 implements MigrationInterface {
  name = 'NormalizedSignupKeys1793150000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        IF EXISTS (
          SELECT 1 FROM users
          GROUP BY lower(btrim(email))
          HAVING count(*) > 1
        ) THEN
          RAISE EXCEPTION 'Duplicate normalized user emails require manual reconciliation';
        END IF;
        IF EXISTS (
          SELECT 1 FROM organizations
          GROUP BY lower(btrim(registration_number))
          HAVING count(*) > 1
        ) THEN
          RAISE EXCEPTION 'Duplicate normalized registration numbers require manual reconciliation';
        END IF;
      END $$;
    `);
    await queryRunner.query(
      'CREATE UNIQUE INDEX "UQ_users_email_normalized" ON "users" (lower(btrim("email")))',
    );
    await queryRunner.query(
      'CREATE UNIQUE INDEX "UQ_organizations_registration_normalized" ON "organizations" (lower(btrim("registration_number")))',
    );
  }

  public async down(): Promise<void> {
    throw new Error(
      'Normalized signup uniqueness requires an explicit audited rollback.',
    );
  }
}
