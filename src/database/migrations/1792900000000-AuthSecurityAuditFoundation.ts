import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Additive, append-only auth audit storage. This is intentionally not the
 * general application log or the platform message-delivery outbox.
 */
export class AuthSecurityAuditFoundation1792900000000 implements MigrationInterface {
  name = 'AuthSecurityAuditFoundation1792900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "auth_security_events" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "event_type" varchar NOT NULL,
        "outcome" varchar NOT NULL,
        "actor_user_id" uuid NULL,
        "subject_user_id" uuid NULL,
        "session_id" uuid NULL,
        "request_source" varchar NOT NULL DEFAULT 'unknown',
        "occurred_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "CHK_auth_security_events_type" CHECK (
          "event_type" IN (
            'sign_in', 'contact_verification', 'password_recovery',
            'password_change', 'session_refresh', 'session_reuse', 'logout',
            'account_state_change', 'oauth_link', 'registration', 'mfa'
          )
        ),
        CONSTRAINT "CHK_auth_security_events_outcome" CHECK (
          "outcome" IN ('succeeded', 'denied', 'failed')
        ),
        CONSTRAINT "CHK_auth_security_events_source" CHECK (
          "request_source" IN ('web', 'mobile', 'api', 'unknown')
        )
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_auth_security_events_subject_time"
        ON "auth_security_events" ("subject_user_id", "occurred_at")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_auth_security_events_type_time"
        ON "auth_security_events" ("event_type", "occurred_at")
    `);
    // Guard the evidence at the storage boundary, even if another code path
    // bypasses AuthSecurityAuditService and issues raw SQL.
    await queryRunner.query(`
      CREATE FUNCTION "reject_auth_security_event_mutation"()
      RETURNS trigger AS $$
      BEGIN
        RAISE EXCEPTION 'Authentication security audit events are immutable';
        RETURN NULL;
      END;
      $$ LANGUAGE plpgsql
    `);
    await queryRunner.query(`
      CREATE TRIGGER "TRG_auth_security_events_no_update_delete"
      BEFORE UPDATE OR DELETE ON "auth_security_events"
      FOR EACH ROW EXECUTE FUNCTION "reject_auth_security_event_mutation"()
    `);
    await queryRunner.query(`
      CREATE TRIGGER "TRG_auth_security_events_no_truncate"
      BEFORE TRUNCATE ON "auth_security_events"
      FOR EACH STATEMENT EXECUTE FUNCTION "reject_auth_security_event_mutation"()
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Deleting audit history by rolling back is prohibited without a
    // separately reviewed retention/migration decision.
    void queryRunner;
    throw new Error('Security audit history cannot be automatically dropped.');
  }
}
