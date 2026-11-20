# Authentication security-event retention policy

Approved for issue #81 on 16 November 2026. This policy applies only to
`auth_security_events` and its encrypted archives. The production event
producers must remain disabled until the retention migration, archive
verification, privileged purge path, and their tests are complete. A passing
application build alone does not authorize production activation.

## Retention and archive

- Retain each event for 24 months from `occurred_at`.
- Keep months 0–12 online in PostgreSQL for investigations.
- Keep months 13–24 in a private, encrypted, immutable object archive with
  version protection. Export before removing the online row.
- Each export needs a manifest with its time range, row count, checksum,
  export time, and retention expiry. Verify the archived object and manifest
  before online deletion.
- Permanently delete the archive at 24 months. Disaster-recovery backups may
  expire through their normal cycle, capped at 30 additional days.
- Grant read-only archive access only for approved security investigations,
  regulatory requests, or legal claims. Audit every access. Temporary restores
  must be destroyed after use.

## Privileged deletion

Runtime application roles, ordinary administrators, and public APIs cannot
update, delete, or truncate events. A dedicated maintenance identity and
retention procedure are the only supported deletion path. The procedure must:

- enforce the 12-month online and 24-month total cutoffs using server time;
- require a verified archive manifest before online deletion;
- process bounded batches without arbitrary event IDs or caller-selected newer
  cutoffs; and
- append the initiator, approval reference, cutoff, manifest/checksum, affected
  row count, and completion status to a separate immutable retention ledger.

Direct SQL, application-role access, and privilege-escalation attempts must be
tested. A failed archive verification or ledger write must stop deletion.

## Holds and erasure requests

A security incident, regulatory request, or legal claim may hold only affected
records. A hold requires security-owner and DPO/legal-owner approval, a reason,
scope, expiry date, and review at least every 90 days. Holds cannot be
indefinite.

Account deletion does not cascade to security events. The privacy/DPO process
assesses erasure requests against the documented security and legal-claims
basis. Necessary records remain restricted until expiry; unrelated identifiers
are irreversibly de-identified where feasible.

The public privacy notice and formal retention schedule must contain this
policy, and the DPO must document the legitimate-interest assessment before
production activation. Those legal documents are not stored in this backend
repository; their approved revisions are a rollout gate. A review draft is in
`docs/auth-security-retention-privacy-material.md`.

## Maintenance deployment contract

Run the additive retention migration as the non-login audit table owner. The
runtime API role, ordinary administrator roles, and the retention worker must
not own, inherit, or be able to `SET ROLE` to that identity. Grant the worker
only schema usage, read access to the events, upload attempts, archive receipts
and holds, insert access to upload attempts, archive receipts and the ledger,
and `EXECUTE` on
`purge_archived_auth_security_events(text,text)`. Grant the separate hold
operator `EXECUTE` on `place_auth_security_legal_hold` only. Keep both functions
unavailable to `PUBLIC`. Review actual role membership and grants before
production activation.

The private archive bucket must have versioning and Object Lock enabled,
with each object locked through its 24-month expiry from `occurred_at`
(rounded up for object-store timestamp precision),
and SSE-B2 encryption (`AES256`). Configure a separate B2 application key.
The writer needs only scoped object write, version read, head and Get Object Retention permissions; permanent version
deletion belongs to the dedicated retention maintenance identity and must be
blocked until the object lock expires. Deny public access. Audit object reads,
deletes and temporary restores. Keep the bucket and database access
separate from application runtime credentials.

The offline worker accepts one operation per invocation:

```text
npm run auth-audit-retention:run:prod -- --archive-batch=100
npm run auth-audit-retention:run:prod -- --purge-online
npm run auth-audit-retention:run:prod -- --purge-archive
```

Set `AUTH_AUDIT_RETENTION_DATABASE_URL`, `AUTH_AUDIT_ARCHIVE_ENDPOINT`,
`AUTH_AUDIT_ARCHIVE_REGION`, `AUTH_AUDIT_ARCHIVE_ACCESS_KEY_ID`,
`AUTH_AUDIT_ARCHIVE_SECRET_ACCESS_KEY`, `AUTH_AUDIT_ARCHIVE_BUCKET`, and
`AUTH_AUDIT_ARCHIVE_FORCE_PATH_STYLE` for every operation. Endpoints must use
HTTPS outside tests. Purges also require `AUTH_AUDIT_RETENTION_INITIATOR` and
`AUTH_AUDIT_RETENTION_APPROVAL_REFERENCE`. Real B2 bucket and key provisioning,
Object Lock verification, and live acceptance remain deferred to #163. The worker
must stay disabled until that gate completes.

The archive operation records an immutable upload attempt, then verifies encryption, compliance lock, version,
content, and manifest before it records an immutable receipt. Online purge is
limited to 100 rows per call. Archive purge is limited to 100 events per
invocation and verifies that all object and manifest versions are absent before
recording completion. It also removes expired objects from failed uploads and
records those separately in the ledger. Failed archive
deletions are recorded as failed ledger attempts and must be investigated.
An archived event older than 24 months that remains online requires manual
incident review; the worker will not destroy its only copy.

Holds are scoped to event IDs, require both approvals, and expire in at most
90 days. A continuing need requires a newly approved hold before the prior
one expires. The hold operator must review holds by their `review_due_at` date.
Archive access requests and temporary restores require a separate approved
security investigation, regulatory request, or legal claim. Document the
request, read access, restore destruction, and DPO decisions outside the event
archive. Never place credentials or protected health information in those
records.
