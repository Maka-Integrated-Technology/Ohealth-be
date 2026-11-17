import { MigrationInterface, QueryRunner } from 'typeorm';

/** Immutable archive receipts and a bounded, privilege-separated online purge. */
export class AuthSecurityRetention1794100000000 implements MigrationInterface {
  name = 'AuthSecurityRetention1794100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const [{ schema_name: schemaName }] = (await queryRunner.query(
      'SELECT current_schema() AS schema_name',
    )) as Array<{ schema_name: string }>;
    const schema = `"${schemaName.replaceAll('"', '""')}"`;

    await queryRunner.query(
      'ALTER TABLE "auth_security_events" DROP CONSTRAINT "CHK_auth_security_events_type"',
    );
    await queryRunner.query(`
      ALTER TABLE "auth_security_events"
      ADD CONSTRAINT "CHK_auth_security_events_type" CHECK ("event_type" IN (
        'sign_in', 'contact_verification', 'password_recovery',
        'password_change', 'session_refresh', 'session_reuse', 'logout',
        'account_state_change', 'oauth_signup', 'oauth_sign_in', 'oauth_link',
        'oauth_unlink', 'oauth_conflict', 'oauth_denial', 'registration',
        'mfa', 'mfa_enrollment_started', 'mfa_activated',
        'mfa_recovery_codes_regenerated', 'mfa_disabled',
        'login_challenge_request', 'login_challenge_resend',
        'login_challenge_delivery', 'login_challenge_expiry',
        'login_challenge_verification', 'context_restoration',
        'authorization_denial'
      ))
    `);

    await queryRunner.query(`
      CREATE TABLE "auth_security_event_archives" (
        "event_id" uuid PRIMARY KEY,
        "occurred_at" timestamptz NOT NULL,
        "object_key" text NOT NULL UNIQUE,
        "object_version_id" text NOT NULL,
        "manifest_key" text NOT NULL UNIQUE,
        "manifest_version_id" text NOT NULL,
        "checksum_sha256" char(64) NOT NULL
          CHECK ("checksum_sha256" ~ '^[0-9a-f]{64}$'),
        "row_count" integer NOT NULL CHECK ("row_count" = 1),
        "exported_at" timestamptz NOT NULL,
        "verified_at" timestamptz NOT NULL,
        "retention_expires_at" timestamptz NOT NULL,
        CONSTRAINT "CHK_auth_security_archive_expiry"
          CHECK ("verified_at" >= "exported_at" AND
                 "retention_expires_at" = "occurred_at" + interval '24 months')
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_auth_security_event_archives_expiry"
        ON "auth_security_event_archives" ("retention_expires_at")
    `);
    await queryRunner.query(`
      CREATE TABLE "auth_security_archive_attempts" (
        "event_id" uuid PRIMARY KEY,
        "object_key" text NOT NULL UNIQUE,
        "manifest_key" text NOT NULL UNIQUE,
        "checksum_sha256" char(64) NOT NULL
          CHECK ("checksum_sha256" ~ '^[0-9a-f]{64}$'),
        "retention_expires_at" timestamptz NOT NULL,
        "started_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_auth_security_archive_attempts_expiry"
        ON "auth_security_archive_attempts" ("retention_expires_at")
    `);
    await queryRunner.query(`
      CREATE TABLE "auth_security_legal_holds" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "event_id" uuid NOT NULL,
        "reason" text NOT NULL CHECK (length(btrim("reason")) BETWEEN 8 AND 500),
        "security_approval" text NOT NULL CHECK (length(btrim("security_approval")) > 0),
        "dpo_legal_approval" text NOT NULL CHECK (length(btrim("dpo_legal_approval")) > 0),
        "approved_at" timestamptz NOT NULL DEFAULT now(),
        "expires_at" timestamptz NOT NULL,
        "review_due_at" timestamptz NOT NULL,
        CONSTRAINT "CHK_auth_security_hold_expiry"
          CHECK ("expires_at" > "approved_at" AND
                 "expires_at" <= "approved_at" + interval '90 days' AND
                 "review_due_at" <= "approved_at" + interval '90 days')
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_auth_security_legal_holds_event_expiry"
        ON "auth_security_legal_holds" ("event_id", "expires_at")
    `);
    await queryRunner.query(`
      CREATE TABLE "auth_security_retention_ledger" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "recorded_at" timestamptz NOT NULL DEFAULT now(),
        "initiator" text NOT NULL CHECK (length(btrim("initiator")) > 0),
        "approval_reference" text NOT NULL CHECK (length(btrim("approval_reference")) > 0),
        "action" varchar NOT NULL CHECK ("action" IN
          ('online_purge', 'archive_purge', 'orphan_purge')),
        "status" varchar NOT NULL CHECK ("status" IN ('completed', 'failed')),
        "cutoff_at" timestamptz NOT NULL,
        "manifest_key" text,
        "checksum_sha256" char(64),
        "rows_affected" integer NOT NULL CHECK ("rows_affected" >= 0)
      )
    `);
    await queryRunner.query(`
      CREATE FUNCTION "reject_auth_security_retention_mutation"()
      RETURNS trigger AS $$
      BEGIN
        RAISE EXCEPTION 'Authentication security retention evidence is immutable';
      END;
      $$ LANGUAGE plpgsql
    `);
    for (const table of [
      'auth_security_event_archives',
      'auth_security_archive_attempts',
      'auth_security_legal_holds',
      'auth_security_retention_ledger',
    ]) {
      await queryRunner.query(`
        CREATE TRIGGER "TRG_${table}_no_update_delete"
        BEFORE UPDATE OR DELETE ON "${table}"
        FOR EACH ROW EXECUTE FUNCTION "reject_auth_security_retention_mutation"()
      `);
      await queryRunner.query(`
        CREATE TRIGGER "TRG_${table}_no_truncate"
        BEFORE TRUNCATE ON "${table}"
        FOR EACH STATEMENT EXECUTE FUNCTION "reject_auth_security_retention_mutation"()
      `);
    }

    // The event trigger permits DELETE only inside the SECURITY DEFINER purge.
    // The table owner must be a non-login migration role in production; the
    // application and maintenance identities must not inherit that role.
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION "reject_auth_security_event_mutation"()
      RETURNS trigger AS $$
      BEGIN
        IF TG_OP = 'DELETE'
           AND current_setting('ohealth.audit_retention_purge', true) = 'on'
           AND current_user = pg_get_userbyid(
             (SELECT relowner FROM pg_class WHERE oid = TG_RELID)
           ) THEN
          RETURN OLD;
        END IF;
        RAISE EXCEPTION 'Authentication security audit events are immutable';
      END;
      $$ LANGUAGE plpgsql
    `);

    await queryRunner.query(`
      CREATE FUNCTION "purge_archived_auth_security_events"(
        p_initiator text, p_approval_reference text
      ) RETURNS integer
      LANGUAGE plpgsql SECURITY DEFINER SET search_path = ${schema}, pg_catalog
      AS $$
      DECLARE
        v_cutoff timestamptz := now() - interval '12 months';
        v_count integer;
      BEGIN
        IF p_initiator IS NULL OR length(btrim(p_initiator)) = 0 OR
           p_approval_reference IS NULL OR
           length(btrim(p_approval_reference)) = 0 THEN
          RAISE EXCEPTION 'Retention initiator and approval are required';
        END IF;
        PERFORM set_config('ohealth.audit_retention_purge', 'on', true);
        WITH eligible AS (
          SELECT e.id
          FROM auth_security_events e
          JOIN auth_security_event_archives a ON a.event_id = e.id
          WHERE e.occurred_at < v_cutoff
            AND a.occurred_at = e.occurred_at
            AND a.verified_at IS NOT NULL
            AND NOT EXISTS (
              SELECT 1 FROM auth_security_legal_holds h
              WHERE h.event_id = e.id AND h.expires_at > now()
            )
          ORDER BY e.occurred_at, e.id
          LIMIT 100
          FOR UPDATE OF e SKIP LOCKED
        ), deleted AS (
          DELETE FROM auth_security_events e
          USING eligible x
          WHERE e.id = x.id
          RETURNING e.id
        ), logged AS (
          INSERT INTO auth_security_retention_ledger
            (initiator, approval_reference, action, status, cutoff_at,
             manifest_key, checksum_sha256, rows_affected)
          SELECT p_initiator, p_approval_reference, 'online_purge',
                 'completed', v_cutoff, a.manifest_key, a.checksum_sha256, 1
          FROM deleted d
          JOIN auth_security_event_archives a ON a.event_id = d.id
          RETURNING id
        )
        SELECT count(*)::integer INTO v_count FROM logged;
        PERFORM set_config('ohealth.audit_retention_purge', 'off', true);
        RETURN v_count;
      END;
      $$
    `);
    await queryRunner.query(
      'REVOKE ALL ON FUNCTION "purge_archived_auth_security_events"(text, text) FROM PUBLIC',
    );

    // Legal holds use the same advisory lock as archive maintenance, so a
    // hold cannot race behind permanent object deletion.
    await queryRunner.query(`
      CREATE FUNCTION "place_auth_security_legal_hold"(
        p_event_id uuid, p_reason text, p_security_approval text,
        p_dpo_legal_approval text, p_expires_at timestamptz
      ) RETURNS uuid
      LANGUAGE plpgsql SECURITY DEFINER SET search_path = ${schema}, pg_catalog
      AS $$
      DECLARE v_hold_id uuid;
      BEGIN
        PERFORM pg_advisory_xact_lock(810081);
        IF p_event_id IS NULL OR p_reason IS NULL OR
           p_security_approval IS NULL OR p_dpo_legal_approval IS NULL OR
           p_expires_at IS NULL THEN
          RAISE EXCEPTION 'Complete legal-hold approval is required';
        END IF;
        IF NOT EXISTS (
          SELECT 1 FROM auth_security_events WHERE id = p_event_id
          UNION ALL
          SELECT 1 FROM auth_security_event_archives a
          WHERE a.event_id = p_event_id AND NOT EXISTS (
            SELECT 1 FROM auth_security_retention_ledger l
            WHERE l.action = 'archive_purge' AND l.status = 'completed'
              AND l.manifest_key = a.manifest_key
          )
        ) THEN
          RAISE EXCEPTION 'Audit event is unavailable for legal hold';
        END IF;
        INSERT INTO auth_security_legal_holds
          (event_id, reason, security_approval, dpo_legal_approval,
           expires_at, review_due_at)
        VALUES (p_event_id, p_reason, p_security_approval,
                p_dpo_legal_approval, p_expires_at,
                LEAST(p_expires_at, now() + interval '90 days'))
        RETURNING id INTO v_hold_id;
        RETURN v_hold_id;
      END;
      $$
    `);
    await queryRunner.query(
      'REVOKE ALL ON FUNCTION "place_auth_security_legal_hold"(uuid, text, text, text, timestamptz) FROM PUBLIC',
    );
  }

  public async down(): Promise<void> {
    throw new Error('Security audit retention evidence cannot be dropped.');
  }
}
