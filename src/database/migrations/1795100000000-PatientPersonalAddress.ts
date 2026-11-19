import { MigrationInterface, QueryRunner } from 'typeorm';

/** Existing patient rows retain all data; absent addresses backfill to NULL. */
export class PatientPersonalAddress1795100000000 implements MigrationInterface {
  name = 'PatientPersonalAddress1795100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "patient_profiles" ADD COLUMN "address" varchar(500)',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "patient_profiles" DROP COLUMN "address"',
    );
  }
}
