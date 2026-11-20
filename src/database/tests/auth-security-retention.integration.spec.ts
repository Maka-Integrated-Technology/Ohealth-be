import { randomUUID } from 'node:crypto';
import { env } from 'node:process';

import {
  DeleteObjectCommand,
  GetObjectCommand,
  GetObjectRetentionCommand,
  HeadObjectCommand,
  ListObjectVersionsCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { DataSource } from 'typeorm';

import { AuthSecurityRetentionService } from '../../modules/auth/security-audit/auth-security-retention.service';
import { AuthSecurityAuditFoundation1792900000000 } from '../migrations/1792900000000-AuthSecurityAuditFoundation';
import { AuthSecurityRetention1794100000000 } from '../migrations/1794100000000-AuthSecurityRetention';

const integration = env.PG_INTEGRATION_URL ? describe : describe.skip;

integration('auth security-event retention on PostgreSQL', () => {
  let admin: DataSource;
  let database: DataSource;
  const schema = `audit_retention_${randomUUID().replaceAll('-', '')}`;
  const runtimeRole = `audit_app_${randomUUID().replaceAll('-', '')}`;
  const maintenanceRole = `audit_maintenance_${randomUUID().replaceAll('-', '')}`;
  const runtimePassword = randomUUID();
  const maintenancePassword = randomUUID();

  function roleUrl(role: string, password: string): string {
    const url = new URL(env.PG_INTEGRATION_URL!);
    url.username = role;
    url.password = password;
    return url.toString();
  }

  beforeAll(async () => {
    admin = new DataSource({
      type: 'postgres',
      url: env.PG_INTEGRATION_URL,
    });
    await admin.initialize();
    await admin.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
    await admin.query(`CREATE SCHEMA "${schema}"`);
    database = new DataSource({
      type: 'postgres',
      url: env.PG_INTEGRATION_URL,
      extra: { options: `-c search_path=${schema},public` },
    });
    await database.initialize();
    const runner = database.createQueryRunner();
    await runner.connect();
    try {
      await new AuthSecurityAuditFoundation1792900000000().up(runner);
      await new AuthSecurityRetention1794100000000().up(runner);
    } finally {
      await runner.release();
    }
    await admin.query(
      `CREATE ROLE "${maintenanceRole}" LOGIN PASSWORD '${maintenancePassword}'`,
    );
    await admin.query(
      `GRANT USAGE ON SCHEMA "${schema}" TO "${maintenanceRole}"`,
    );
    await admin.query(
      `GRANT EXECUTE ON FUNCTION "${schema}".purge_archived_auth_security_events(text, text)
       TO "${maintenanceRole}"`,
    );
  });

  afterAll(async () => {
    if (database?.isInitialized) await database.destroy();
    if (admin?.isInitialized) {
      await admin.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      await admin.query(`DROP ROLE IF EXISTS "${runtimeRole}"`);
      await admin.query(`DROP ROLE IF EXISTS "${maintenanceRole}"`);
      await admin.destroy();
    }
  });

  async function insertEvent(monthsOld: number): Promise<string> {
    const id = randomUUID();
    await database.query(
      `INSERT INTO auth_security_events
         (id, event_type, outcome, occurred_at)
       VALUES ($1, 'sign_in', 'denied', now() - ($2 * interval '1 month'))`,
      [id, monthsOld],
    );
    return id;
  }

  async function archive(eventId: string): Promise<void> {
    await database.query(
      `INSERT INTO auth_security_event_archives
         (event_id, occurred_at, object_key, object_version_id,
          manifest_key, manifest_version_id, checksum_sha256, row_count,
          exported_at, verified_at, retention_expires_at)
       SELECT e.id, e.occurred_at, $2, 'object-version', $3,
              'manifest-version', repeat('a', 64), 1, now(), now(),
              e.occurred_at + interval '24 months'
       FROM auth_security_events e WHERE e.id = $1`,
      [eventId, `events/${eventId}`, `manifests/${eventId}`],
    );
  }

  it('exports and reads back an encrypted immutable object and manifest before purging', async () => {
    const eventId = await insertEvent(13);
    const stored = new Map<
      string,
      { body: Buffer; lastModified: Date; retainUntil: Date }
    >();
    const putProtection: Array<{
      encryption: string | undefined;
      lockMode: string | undefined;
      condition: string | undefined;
    }> = [];
    const send = jest.fn(async (command: unknown) => {
      if (command instanceof ListObjectVersionsCommand) {
        const key = command.input.Prefix!;
        return {
          IsTruncated: false,
          Versions: stored.has(key) ? [{ Key: key, VersionId: 'v1' }] : [],
        };
      }
      if (command instanceof PutObjectCommand) {
        const key = command.input.Key!;
        putProtection.push({
          encryption: command.input.ServerSideEncryption,
          lockMode: command.input.ObjectLockMode,
          condition: command.input.IfNoneMatch,
        });
        stored.set(key, {
          body: command.input.Body as Buffer,
          lastModified: new Date(),
          retainUntil: command.input.ObjectLockRetainUntilDate!,
        });
        return { VersionId: 'v1' };
      }
      if (command instanceof HeadObjectCommand) {
        const object = stored.get(command.input.Key!);
        if (!object) throw new Error('object missing');
        return {
          VersionId: 'v1',
          LastModified: object.lastModified,
          ServerSideEncryption: 'AES256',
          ContentLength: object.body.length,
        };
      }
      if (command instanceof GetObjectRetentionCommand) {
        const object = stored.get(command.input.Key!);
        if (!object) throw new Error('object missing');
        if (command.input.VersionId !== 'v1')
          throw new Error('wrong retention version');
        return {
          Retention: {
            Mode: 'COMPLIANCE',
            RetainUntilDate: object.retainUntil,
          },
        };
      }
      if (command instanceof GetObjectCommand) {
        const object = stored.get(command.input.Key!);
        if (!object) throw new Error('object missing');
        return {
          Body: { transformToByteArray: async () => object.body },
        };
      }
      throw new Error('unexpected S3 command');
    });
    const service = new AuthSecurityRetentionService(
      database,
      { send } as unknown as S3Client,
      { bucket: 'private-audit-test' },
    );
    expect(await service.archiveNext()).toBe(true);
    expect(putProtection).toEqual([
      { encryption: 'AES256', lockMode: 'COMPLIANCE', condition: undefined },
      { encryption: 'AES256', lockMode: 'COMPLIANCE', condition: undefined },
    ]);
    const receipts: Array<{
      event_id: string;
      object_key: string;
      manifest_key: string;
      checksum_sha256: string;
    }> = await database.query(
      'SELECT event_id, object_key, manifest_key, checksum_sha256 ' +
        'FROM auth_security_event_archives WHERE event_id = $1',
      [eventId],
    );
    expect(receipts).toHaveLength(1);
    expect(receipts[0].checksum_sha256).toMatch(/^[0-9a-f]{64}$/);
    const eventBody = stored.get(receipts[0].object_key)!.body.toString();
    const manifest = JSON.parse(
      stored.get(receipts[0].manifest_key)!.body.toString(),
    ) as { row_count: number; checksum_sha256: string };
    expect(JSON.parse(eventBody)).toMatchObject({
      id: eventId,
      event_type: 'sign_in',
      outcome: 'denied',
    });
    const exact: Array<{ occurred_at: string }> = await database.query(
      'SELECT occurred_at::text AS occurred_at FROM auth_security_events WHERE id = $1',
      [eventId],
    );
    expect((JSON.parse(eventBody) as { occurred_at: string }).occurred_at).toBe(
      exact[0].occurred_at,
    );
    expect(eventBody).not.toContain('password');
    expect(manifest).toMatchObject({
      row_count: 1,
      checksum_sha256: receipts[0].checksum_sha256,
    });
    expect(await service.purgeOnline('security-operator', 'APPROVAL-81')).toBe(
      1,
    );
    expect(
      await database.query(
        'SELECT id FROM auth_security_events WHERE id = $1',
        [eventId],
      ),
    ).toEqual([]);
  });

  it('requires verified archive evidence and a 12-month cutoff', async () => {
    const eligible = await insertEvent(13);
    const unarchived = await insertEvent(13);
    const newer = await insertEvent(11);
    await archive(eligible);
    await archive(newer);

    const rows: Array<{ purged: number }> = await database.query(
      `SELECT purge_archived_auth_security_events('security-operator', 'APPROVAL-81') AS purged`,
    );
    expect(rows).toEqual([{ purged: 1 }]);
    const remaining: Array<{ id: string }> = await database.query(
      'SELECT id FROM auth_security_events ORDER BY id',
    );
    expect(remaining.map((row) => row.id).sort()).toEqual(
      [unarchived, newer].sort(),
    );
    const ledger = await database.query(
      'SELECT initiator, approval_reference, action, status, ' +
        'manifest_key, checksum_sha256, rows_affected ' +
        'FROM auth_security_retention_ledger WHERE manifest_key = $1',
      [`manifests/${eligible}`],
    );
    expect(ledger).toEqual([
      {
        initiator: 'security-operator',
        approval_reference: 'APPROVAL-81',
        action: 'online_purge',
        status: 'completed',
        manifest_key: `manifests/${eligible}`,
        checksum_sha256: 'a'.repeat(64),
        rows_affected: 1,
      },
    ]);
  });

  it('blocks purge under a scoped, dual-approved legal hold', async () => {
    const held = await insertEvent(13);
    const unrelated = await insertEvent(13);
    await archive(held);
    await archive(unrelated);
    await database.query(
      `SELECT place_auth_security_legal_hold(
         $1, 'Approved security investigation', 'SEC-81', 'DPO-81',
         now() + interval '30 days')`,
      [held],
    );
    const result: Array<{ purged: number }> = await database.query(
      `SELECT purge_archived_auth_security_events(
         'security-operator', 'APPROVAL-81') AS purged`,
    );
    expect(result).toEqual([{ purged: 1 }]);
    const remaining: Array<{ id: string }> = await database.query(
      'SELECT id FROM auth_security_events WHERE id = ANY($1::uuid[])',
      [[held, unrelated]],
    );
    expect(remaining).toEqual([{ id: held }]);
    await expect(
      database.query(
        `SELECT place_auth_security_legal_hold(
           $1, 'Approved security investigation', 'SEC-81', 'DPO-81',
           now() + interval '91 days')`,
        [held],
      ),
    ).rejects.toThrow();
  });

  it('allows only the granted maintenance identity to invoke the bounded purge', async () => {
    const eventId = await insertEvent(13);
    await archive(eventId);
    const maintenance = new DataSource({
      type: 'postgres',
      url: roleUrl(maintenanceRole, maintenancePassword),
      extra: { options: `-c search_path=${schema},public` },
    });
    await maintenance.initialize();
    try {
      const identity: Array<{ current_user: string }> = await maintenance.query(
        'SELECT current_user',
      );
      expect(identity).toEqual([{ current_user: maintenanceRole }]);
      const result: Array<{ purged: number }> = await maintenance.query(
        `SELECT purge_archived_auth_security_events(
           'maintenance-operator', 'APPROVAL-81') AS purged`,
      );
      expect(result[0].purged).toBeGreaterThanOrEqual(1);
    } finally {
      await maintenance.destroy();
    }
    expect(
      await database.query(
        'SELECT id FROM auth_security_events WHERE id = $1',
        [eventId],
      ),
    ).toEqual([]);
  });

  it('leaves a durable attempt and the online event when archive readback fails', async () => {
    await insertEvent(13);
    let retainUntil: Date;
    let contentLength = 0;
    let uploaded = false;
    const send = jest.fn(async (command: unknown) => {
      if (command instanceof ListObjectVersionsCommand) {
        return {
          IsTruncated: false,
          Versions: uploaded
            ? [{ Key: command.input.Prefix, VersionId: 'v1' }]
            : [],
        };
      }
      if (command instanceof PutObjectCommand) {
        uploaded = true;
        contentLength = (command.input.Body as Buffer).length;
        retainUntil = command.input.ObjectLockRetainUntilDate!;
        return { VersionId: 'v1' };
      }
      if (command instanceof HeadObjectCommand) {
        return {
          VersionId: 'v1',
          LastModified: new Date(),
          ServerSideEncryption: 'AES256',
          ContentLength: contentLength,
        };
      }
      if (command instanceof GetObjectRetentionCommand) {
        if (command.input.VersionId !== 'v1')
          throw new Error('wrong retention version');
        return {
          Retention: { Mode: 'COMPLIANCE', RetainUntilDate: retainUntil },
        };
      }
      if (command instanceof GetObjectCommand) {
        throw new Error('readback unavailable');
      }
      throw new Error('unexpected S3 command');
    });
    const service = new AuthSecurityRetentionService(
      database,
      { send } as unknown as S3Client,
      { bucket: 'private-audit-test' },
    );
    await expect(service.archiveNext()).rejects.toThrow('readback unavailable');
    const attempts: Array<{ event_id: string }> = await database.query(
      `SELECT o.event_id FROM auth_security_archive_attempts o
       LEFT JOIN auth_security_event_archives a ON a.event_id = o.event_id
       WHERE a.event_id IS NULL`,
    );
    expect(attempts).toHaveLength(1);
    const attemptedEventId = attempts[0].event_id;
    expect(
      await database.query(
        'SELECT event_id FROM auth_security_event_archives WHERE event_id = $1',
        [attemptedEventId],
      ),
    ).toEqual([]);
    expect(
      await database.query(
        'SELECT id FROM auth_security_events WHERE id = $1',
        [attemptedEventId],
      ),
    ).toEqual([{ id: attemptedEventId }]);
  });

  it('prevents direct SQL mutations and rejects an unprivileged runtime role', async () => {
    const held = await insertEvent(13);
    await archive(held);
    await database.query(
      `SELECT place_auth_security_legal_hold(
         $1, 'active legal claim', 'SEC-81', 'DPO-81',
         now() + interval '30 days')`,
      [held],
    );
    await expect(
      database.query('DELETE FROM auth_security_events WHERE id = $1', [held]),
    ).rejects.toThrow('immutable');
    await expect(
      database.query(
        'UPDATE auth_security_events SET outcome = $2 WHERE id = $1',
        [held, 'failed'],
      ),
    ).rejects.toThrow('immutable');
    await expect(
      database.query('TRUNCATE auth_security_events'),
    ).rejects.toThrow('immutable');
    await expect(
      database.query('DELETE FROM auth_security_retention_ledger'),
    ).rejects.toThrow('immutable');
    await admin.query(
      `CREATE ROLE "${runtimeRole}" LOGIN PASSWORD '${runtimePassword}'`,
    );
    await admin.query(`GRANT USAGE ON SCHEMA "${schema}" TO "${runtimeRole}"`);
    await admin.query(
      `GRANT SELECT, DELETE ON "${schema}".auth_security_events TO "${runtimeRole}"`,
    );
    const runner = database.createQueryRunner();
    await runner.connect();
    try {
      await runner.query(`SET ROLE "${runtimeRole}"`);
      await expect(
        runner.query('DELETE FROM auth_security_events WHERE id = $1', [held]),
      ).rejects.toThrow('immutable');
      await runner.query(
        "SELECT set_config('ohealth.audit_retention_purge', 'on', false)",
      );
      await expect(
        runner.query('DELETE FROM auth_security_events WHERE id = $1', [held]),
      ).rejects.toThrow('immutable');
      await expect(
        runner.query(
          `SELECT purge_archived_auth_security_events('runtime', 'none')`,
        ),
      ).rejects.toThrow('permission denied');
      await expect(
        runner.query(
          `SELECT place_auth_security_legal_hold(
             $1, 'active legal claim', 'SEC-81', 'DPO-81',
             now() + interval '30 days')`,
          [held],
        ),
      ).rejects.toThrow('permission denied');
    } finally {
      await runner.query('RESET ROLE');
      await runner.release();
    }
    const runtime = new DataSource({
      type: 'postgres',
      url: roleUrl(runtimeRole, runtimePassword),
      extra: { options: `-c search_path=${schema},public` },
    });
    await runtime.initialize();
    try {
      const identity: Array<{ current_user: string }> = await runtime.query(
        'SELECT current_user',
      );
      expect(identity).toEqual([{ current_user: runtimeRole }]);
      const owner: Array<{ owner: string }> = await database.query(
        `SELECT pg_get_userbyid(relowner) AS owner FROM pg_class
         WHERE oid = 'auth_security_events'::regclass`,
      );
      await expect(
        runtime.query(`SET ROLE "${owner[0].owner}"`),
      ).rejects.toThrow('permission denied');
    } finally {
      await runtime.destroy();
    }
    const purged = await database.query(
      `SELECT purge_archived_auth_security_events('security-operator', 'APPROVAL-81') AS purged`,
    );
    expect(purged).toEqual([{ purged: 0 }]);
  });

  it('deletes every expired object version and records archive purge', async () => {
    const eventId = await insertEvent(25);
    await archive(eventId);
    await database.query(
      "SELECT purge_archived_auth_security_events('operator', 'APPROVAL-81')",
    );
    const objects = new Map<string, Set<string>>([
      [`events/${eventId}`, new Set(['v1', 'v2'])],
      [`manifests/${eventId}`, new Set(['v1'])],
    ]);
    const send = jest.fn(async (command: unknown) => {
      if (command instanceof ListObjectVersionsCommand) {
        const key = command.input.Prefix!;
        return {
          IsTruncated: false,
          Versions: [...(objects.get(key) ?? [])].map((version) => ({
            Key: key,
            VersionId: version,
          })),
        };
      }
      if (command instanceof DeleteObjectCommand) {
        objects.get(command.input.Key!)?.delete(command.input.VersionId!);
        return {};
      }
      throw new Error('unexpected S3 command');
    });
    const service = new AuthSecurityRetentionService(
      database,
      { send } as unknown as S3Client,
      { bucket: 'private-audit-test' },
    );
    expect(await service.purgeExpiredArchive('operator', 'APPROVAL-81')).toBe(
      true,
    );
    expect([...objects.values()].every((versions) => versions.size === 0)).toBe(
      true,
    );
    expect(await service.purgeExpiredArchive('operator', 'APPROVAL-81')).toBe(
      false,
    );
    const ledger = await database.query(
      `SELECT status, rows_affected FROM auth_security_retention_ledger
       WHERE action = 'archive_purge' AND manifest_key = $1`,
      [`manifests/${eventId}`],
    );
    expect(ledger).toEqual([{ status: 'completed', rows_affected: 1 }]);
  });

  it('records a failed archive deletion without claiming completion', async () => {
    const eventId = await insertEvent(25);
    await archive(eventId);
    await database.query(
      "SELECT purge_archived_auth_security_events('operator', 'APPROVAL-81')",
    );
    const send = jest.fn(async (command: unknown) => {
      if (command instanceof ListObjectVersionsCommand) {
        return {
          IsTruncated: false,
          Versions: [{ Key: command.input.Prefix, VersionId: 'v1' }],
        };
      }
      if (command instanceof DeleteObjectCommand) {
        throw new Error('immutable storage refused deletion');
      }
      throw new Error('unexpected S3 command');
    });
    const service = new AuthSecurityRetentionService(
      database,
      { send } as unknown as S3Client,
      { bucket: 'private-audit-test' },
    );
    await expect(
      service.purgeExpiredArchive('operator', 'APPROVAL-81'),
    ).rejects.toThrow('immutable storage refused deletion');
    const ledger = await database.query(
      `SELECT status, rows_affected FROM auth_security_retention_ledger
       WHERE action = 'archive_purge' AND manifest_key = $1`,
      [`manifests/${eventId}`],
    );
    expect(ledger).toEqual([{ status: 'failed', rows_affected: 0 }]);
  });

  it('purges expired upload attempts with no verified receipt', async () => {
    const eventId = await insertEvent(25);
    const objectKey = `orphan/${eventId}`;
    const manifestKey = `orphan/${eventId}.manifest`;
    await database.query(
      `INSERT INTO auth_security_archive_attempts
         (event_id, object_key, manifest_key, checksum_sha256,
          retention_expires_at)
       SELECT id, $2, $3, repeat('b', 64),
              occurred_at + interval '24 months'
       FROM auth_security_events WHERE id = $1`,
      [eventId, objectKey, manifestKey],
    );
    const objects = new Set([objectKey]);
    const send = jest.fn(async (command: unknown) => {
      if (command instanceof ListObjectVersionsCommand) {
        const key = command.input.Prefix!;
        return {
          IsTruncated: false,
          Versions: objects.has(key) ? [{ Key: key, VersionId: 'v1' }] : [],
        };
      }
      if (command instanceof DeleteObjectCommand) {
        objects.delete(command.input.Key!);
        return {};
      }
      throw new Error('unexpected S3 command');
    });
    const service = new AuthSecurityRetentionService(
      database,
      { send } as unknown as S3Client,
      { bucket: 'private-audit-test' },
    );
    expect(await service.purgeExpiredArchive('operator', 'APPROVAL-81')).toBe(
      true,
    );
    // The preceding failure test also left an expired candidate for retry.
    if (objects.size !== 0) {
      await service.purgeExpiredArchive('operator', 'APPROVAL-81');
    }
    expect(objects.size).toBe(0);
    expect(await service.purgeExpiredArchive('operator', 'APPROVAL-81')).toBe(
      false,
    );
    const ledger = await database.query(
      `SELECT status, rows_affected FROM auth_security_retention_ledger
       WHERE action = 'orphan_purge' AND manifest_key = $1`,
      [manifestKey],
    );
    expect(ledger).toEqual([{ status: 'completed', rows_affected: 0 }]);
  });
});
