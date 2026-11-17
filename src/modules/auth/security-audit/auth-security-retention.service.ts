import { createHash } from 'node:crypto';

import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectVersionsCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { DataSource } from 'typeorm';

interface IArchiveCandidate {
  id: string;
  event_type: string;
  outcome: string;
  actor_user_id: string | null;
  subject_user_id: string | null;
  session_id: string | null;
  request_source: string;
  occurred_at: Date;
  occurred_at_exact: string;
  retention_expires_at: Date;
  retention_expires_at_exact: string;
}

interface IExpiredArchive {
  action: 'archive_purge' | 'orphan_purge';
  event_id: string;
  object_key: string;
  manifest_key: string;
  checksum_sha256: string;
  retention_expires_at: Date;
}

interface IImmutableObject {
  key: string;
  versionId: string;
  lastModified: Date;
}

export interface IAuthSecurityRetentionOptions {
  bucket: string;
  kmsKeyId: string;
}

const ADVISORY_LOCK = 810081;
const MAX_ARCHIVE_BYTES = 8192;

/**
 * Offline maintenance boundary. It deliberately uses a dedicated database
 * identity and private object-store credentials, never the API request path.
 */
export class AuthSecurityRetentionService {
  constructor(
    private readonly database: DataSource,
    private readonly s3: S3Client,
    private readonly options: IAuthSecurityRetentionOptions,
  ) {
    if (!options.bucket || !options.kmsKeyId) {
      throw new Error('Audit archive bucket and KMS key are required.');
    }
  }

  /** Archive one eligible event; repeat with a bounded operator batch size. */
  async archiveNext(): Promise<boolean> {
    const runner = this.database.createQueryRunner();
    await runner.connect();
    let locked = false;
    try {
      const lock: Array<{ acquired: boolean }> = await runner.query(
        'SELECT pg_try_advisory_lock($1) AS acquired',
        [ADVISORY_LOCK],
      );
      if (!lock[0]?.acquired) return false;
      locked = true;
      const rows: IArchiveCandidate[] = await runner.query(
        `SELECT e.id, e.event_type, e.outcome, e.actor_user_id,
                e.subject_user_id, e.session_id, e.request_source,
                e.occurred_at, e.occurred_at::text AS occurred_at_exact,
                e.occurred_at + interval '24 months' AS retention_expires_at,
                (e.occurred_at + interval '24 months')::text
                  AS retention_expires_at_exact
         FROM auth_security_events e
         LEFT JOIN auth_security_event_archives a ON a.event_id = e.id
         WHERE a.event_id IS NULL
           AND e.occurred_at < now() - interval '12 months'
           AND e.occurred_at + interval '24 months' > now()
         ORDER BY e.occurred_at, e.id LIMIT 1`,
      );
      const event = rows[0];
      if (!event) return false;

      const eventBody = Buffer.from(
        JSON.stringify({
          id: event.id,
          event_type: event.event_type,
          outcome: event.outcome,
          actor_user_id: event.actor_user_id,
          subject_user_id: event.subject_user_id,
          session_id: event.session_id,
          request_source: event.request_source,
          occurred_at: event.occurred_at_exact,
        }),
      );
      if (eventBody.length > MAX_ARCHIVE_BYTES) {
        throw new Error('Audit event exceeds the archive size limit.');
      }
      const checksum = createHash('sha256').update(eventBody).digest('hex');
      const prefix = `auth-security-events/v1/${event.occurred_at.toISOString().slice(0, 7)}/${event.id}`;
      const objectKey = `${prefix}.json`;
      const manifestKey = `${prefix}.manifest.json`;
      await runner.query(
        `INSERT INTO auth_security_archive_attempts
           (event_id, object_key, manifest_key, checksum_sha256,
            retention_expires_at)
         SELECT id, $2, $3, $4, occurred_at + interval '24 months'
         FROM auth_security_events WHERE id = $1
         ON CONFLICT (event_id) DO NOTHING`,
        [event.id, objectKey, manifestKey, checksum],
      );
      const attempts: Array<{
        object_key: string;
        manifest_key: string;
        checksum_sha256: string;
      }> = await runner.query(
        `SELECT object_key, manifest_key, checksum_sha256
         FROM auth_security_archive_attempts WHERE event_id = $1`,
        [event.id],
      );
      if (
        attempts[0]?.object_key !== objectKey ||
        attempts[0]?.manifest_key !== manifestKey ||
        attempts[0]?.checksum_sha256 !== checksum
      ) {
        throw new Error('Immutable archive attempt does not match event.');
      }
      // PostgreSQL retains microseconds; the S3 API accepts millisecond dates.
      // Round upward so Object Lock never ends before the exact event expiry.
      const retainUntil = new Date(event.retention_expires_at.getTime() + 1000);
      const object = await this.putAndVerify(objectKey, eventBody, retainUntil);
      const manifest = {
        time_range_start: event.occurred_at_exact,
        time_range_end: event.occurred_at_exact,
        row_count: 1,
        checksum_sha256: checksum,
        exported_at: object.lastModified.toISOString(),
        retention_expires_at: event.retention_expires_at_exact,
      };
      const manifestObject = await this.putAndVerify(
        manifestKey,
        Buffer.from(JSON.stringify(manifest)),
        retainUntil,
      );
      const receipts: Array<{ event_id: string }> = await runner.query(
        `INSERT INTO auth_security_event_archives
           (event_id, occurred_at, object_key, object_version_id,
            manifest_key, manifest_version_id, checksum_sha256, row_count,
            exported_at, verified_at, retention_expires_at)
         SELECT e.id, e.occurred_at, $2, $3, $4, $5, $6, 1, $7,
                now(), e.occurred_at + interval '24 months'
         FROM auth_security_events e WHERE e.id = $1
         RETURNING event_id`,
        [
          event.id,
          object.key,
          object.versionId,
          manifestObject.key,
          manifestObject.versionId,
          checksum,
          object.lastModified,
        ],
      );
      if (receipts.length !== 1) {
        throw new Error(
          'Audit event disappeared before archive receipt commit.',
        );
      }
      return true;
    } finally {
      if (locked) {
        await runner.query('SELECT pg_advisory_unlock($1)', [ADVISORY_LOCK]);
      }
      await runner.release();
    }
  }

  async purgeOnline(
    initiator: string,
    approvalReference: string,
  ): Promise<number> {
    const rows: Array<{ purged: number }> = await this.database.query(
      'SELECT purge_archived_auth_security_events($1, $2) AS purged',
      [initiator, approvalReference],
    );
    return rows[0].purged;
  }

  /** Permanently delete one expired archive, then commit its ledger receipt. */
  async purgeExpiredArchive(
    initiator: string,
    approvalReference: string,
  ): Promise<boolean> {
    if (!initiator.trim() || !approvalReference.trim()) {
      throw new Error('Retention initiator and approval are required.');
    }
    const runner = this.database.createQueryRunner();
    await runner.connect();
    let locked = false;
    try {
      const lock: Array<{ acquired: boolean }> = await runner.query(
        'SELECT pg_try_advisory_lock($1) AS acquired',
        [ADVISORY_LOCK],
      );
      if (!lock[0]?.acquired) return false;
      locked = true;
      const rows: IExpiredArchive[] = await runner.query(
        `WITH candidates AS (
           SELECT 'archive_purge' AS action, a.event_id, a.object_key,
                  a.manifest_key, a.checksum_sha256, a.retention_expires_at
           FROM auth_security_event_archives a
           WHERE NOT EXISTS (
             SELECT 1 FROM auth_security_events e WHERE e.id = a.event_id
           )
           UNION ALL
           SELECT 'orphan_purge' AS action, o.event_id, o.object_key,
                  o.manifest_key, o.checksum_sha256, o.retention_expires_at
           FROM auth_security_archive_attempts o
           WHERE NOT EXISTS (
             SELECT 1 FROM auth_security_event_archives a
             WHERE a.event_id = o.event_id
           )
         )
         SELECT c.* FROM candidates c
         WHERE c.retention_expires_at <= now()
           AND NOT EXISTS (
             SELECT 1 FROM auth_security_legal_holds h
             WHERE h.event_id = c.event_id AND h.expires_at > now()
           )
           AND NOT EXISTS (
             SELECT 1 FROM auth_security_retention_ledger l
             WHERE l.action = c.action AND l.status = 'completed'
               AND l.manifest_key = c.manifest_key
           )
         ORDER BY c.retention_expires_at, c.event_id LIMIT 1`,
      );
      const archive = rows[0];
      if (!archive) return false;
      const ledgerValues = [
        initiator,
        approvalReference,
        archive.retention_expires_at,
        archive.manifest_key,
        archive.checksum_sha256,
        archive.action,
        archive.action === 'archive_purge' ? 1 : 0,
      ];
      try {
        await this.deleteEveryVersion(archive.object_key);
        await this.deleteEveryVersion(archive.manifest_key);
        await runner.query(
          `INSERT INTO auth_security_retention_ledger
             (initiator, approval_reference, action, status, cutoff_at,
              manifest_key, checksum_sha256, rows_affected)
           VALUES ($1, $2, $6, 'completed', $3, $4, $5, $7)`,
          ledgerValues,
        );
      } catch (error) {
        try {
          await runner.query(
            `INSERT INTO auth_security_retention_ledger
               (initiator, approval_reference, action, status, cutoff_at,
                manifest_key, checksum_sha256, rows_affected)
             VALUES ($1, $2, $6, 'failed', $3, $4, $5, 0)`,
            ledgerValues.slice(0, 6),
          );
        } catch {
          // The original operation still fails closed if the ledger is down.
        }
        throw error;
      }
      return true;
    } finally {
      if (locked) {
        await runner.query('SELECT pg_advisory_unlock($1)', [ADVISORY_LOCK]);
      }
      await runner.release();
    }
  }

  private async deleteEveryVersion(key: string): Promise<void> {
    // A retry can begin after a prior delete succeeded but before its ledger
    // insert committed. List all versions, including delete markers.
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const listed = await this.s3.send(
        new ListObjectVersionsCommand({
          Bucket: this.options.bucket,
          Prefix: key,
          MaxKeys: 1000,
        }),
      );
      if (listed.IsTruncated) {
        throw new Error('Archive has too many versions to purge safely.');
      }
      const versions = [
        ...(listed.Versions ?? []),
        ...(listed.DeleteMarkers ?? []),
      ].filter((item) => item.Key === key);
      if (versions.length === 0) return;
      for (const version of versions) {
        if (!version.VersionId) {
          throw new Error('Archive version identifier is missing.');
        }
        await this.s3.send(
          new DeleteObjectCommand({
            Bucket: this.options.bucket,
            Key: key,
            VersionId: version.VersionId,
          }),
        );
      }
    }
    throw new Error('Archive versions remain after permanent deletion.');
  }

  private async putAndVerify(
    key: string,
    body: Buffer,
    retainUntil: Date,
  ): Promise<IImmutableObject> {
    try {
      await this.s3.send(
        new PutObjectCommand({
          Bucket: this.options.bucket,
          Key: key,
          Body: body,
          ContentType: 'application/json',
          ServerSideEncryption: 'aws:kms',
          SSEKMSKeyId: this.options.kmsKeyId,
          ObjectLockMode: 'COMPLIANCE',
          ObjectLockRetainUntilDate: retainUntil,
          IfNoneMatch: '*',
        }),
      );
    } catch (error) {
      const status = (error as { $metadata?: { httpStatusCode?: number } })
        .$metadata?.httpStatusCode;
      if (status !== 412) throw error;
      // A previous attempt may have uploaded before its DB receipt committed.
      // Only exact, still-locked content is accepted on retry.
    }

    const head = await this.s3.send(
      new HeadObjectCommand({ Bucket: this.options.bucket, Key: key }),
    );
    if (
      !head.VersionId ||
      !head.LastModified ||
      head.ServerSideEncryption !== 'aws:kms' ||
      head.SSEKMSKeyId !== this.options.kmsKeyId ||
      head.ObjectLockMode !== 'COMPLIANCE' ||
      !head.ObjectLockRetainUntilDate ||
      head.ObjectLockRetainUntilDate < retainUntil ||
      head.ObjectLockRetainUntilDate.getTime() >
        retainUntil.getTime() + 60_000 ||
      head.ContentLength === undefined ||
      head.ContentLength > MAX_ARCHIVE_BYTES
    ) {
      throw new Error(
        'Audit archive object lacks verified immutable protection.',
      );
    }
    const fetched = await this.s3.send(
      new GetObjectCommand({
        Bucket: this.options.bucket,
        Key: key,
        VersionId: head.VersionId,
      }),
    );
    if (!fetched.Body) throw new Error('Audit archive object is empty.');
    const readBack = Buffer.from(await fetched.Body.transformToByteArray());
    if (!body.equals(readBack)) {
      throw new Error('Audit archive read-back checksum mismatch.');
    }
    return { key, versionId: head.VersionId, lastModified: head.LastModified };
  }
}
