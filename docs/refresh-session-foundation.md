# Refresh session foundation — draft work for #77

This branch implements the PostgreSQL session primitive from
`02-identity-and-access.md`. It is deliberately not registered in `AuthModule`:
the live HTTP auth flow still uses the legacy session implementation. This is
not a completed security remediation and must remain draft until #75 and #76
are merged and integrated.

## Implemented boundary

- An opaque 256-bit random refresh secret is returned once; only SHA-256
  verifiers are persisted. No user-controlled token is decoded as a JWT.
- The stable `auth_sessions.session_id` is the token family. Version 2 marks
  canonical families; version 1 identifies legacy sessions.
- Every consumed verifier remains in `auth_refresh_credentials` until the
  family's absolute expiry. Replaying a consumed verifier revokes the entire
  family, including its latest replacement and access-token session identity.
- Rotation locks the user, then family, in one transaction. Parallel refreshes
  produce at most one replacement; the losing replay revokes that replacement.
  Clients must serialize refresh calls and must not retry a lost response with
  the previous token.
- Signing, verifier consumption and replacement persistence share a transaction.
  Signing failure rolls all writes back. Replay revocation commits before 401.
- Session validation checks current canonical account state, ownership, family
  version, expiry and revocation. JWTs carry only `sub`, `sid`, `jti`, `iat`, `exp`.
- Logout and rotation use the same user lock. `revokeAllInTransaction` requires
  an active transaction and acquires that lock so credential changes and all
  session revocations can commit or roll back together.
- Session listing selects only identifiers and creation/activity/expiry times.
  Device labels and request metadata are not collected in this foundation.
- The service requires an explicit signing secret of at least 32 characters,
  an access lifetime of 1–900 seconds, and an absolute refresh lifetime of
  1–2,592,000 seconds. Configuration accepts seconds or `s`, `m`, `h`, `d` units.

The migration is additive and does not expire existing sessions yet. Its rollback
revokes version-2 sessions before dropping their verifier history. The applied
baseline migration is unchanged.

## Integration still required before ready for review

1. Rebase on merged #76 and #75; use the shared password policy and finalized
   challenge/reset transaction. Verify the original password inside the same
   user-lock transaction as session issuance or credential mutation, so an old
   password cannot issue a session after a concurrent reset.
2. Register the canonical service and entity in the application. Route every
   credential issuer through it, replace legacy refresh, and require `sid` with
   explicit algorithm validation in the JWT strategy. Resolve legacy roles from
   current server-side state while #80 migrates authorization.
3. Replace logout/session management HTTP wiring with authenticated ownership
   checks. Add safe OpenAPI contracts and regenerate the client. Define browser
   HTTP-only cookie and CSRF behavior and mobile transport compatibility.
4. Wire reset, password change and account-security events into atomic revoke-all.
   Add HTTP/e2e tests against the real finalized challenge implementation.
5. Add durable, privacy-safe issuance, refresh-reuse and revocation audit events
   under #81 conventions, within the relevant transaction.
6. Validate session configuration at application startup without legacy fallback
   secrets. The current live auth module still has its original fallback values.
7. At cutover, revoke all version-1 sessions and reject legacy JWTs; coordinate
   mandatory reauthentication with consumers. Do not silently promote old
   credentials or deploy a mixed issuance/validation implementation.
8. Obtain the tracker-required senior review before treating the implementation
   as complete or ready to merge.

## Retention and deletion

Families reference users and verifier history references families, both with
database cascade deletion. Verifier history is security state, never telemetry.
Keep consumed verifiers through absolute family expiry, even after revocation;
do not log or export them. A scheduled cleanup should delete expired version-2
families after the bounded access-token lifetime (15 minutes). Revocation audit
retention is a separate policy and must not preserve refresh verifiers. Add the
cleanup worker before production cutover; this branch does not collect new IP,
user-agent, device or clinical data.

## Local verification

Use PostgreSQL 16 and the repository's Node 24 runtime:

```sh
npm ci --ignore-scripts
docker compose up -d db mailpit
# Create a local ignored .env from .env.example, DB_PORT=5434, random JWT secrets.
npm run migration:run
PG_INTEGRATION_URL=postgres://postgres:postgres@localhost:5434/app_db \
  npx jest --runInBand src/database/tests/refresh-session.integration.spec.ts
npm test -- --runInBand
npm run build
```

The integration suite creates a disposable database, runs actual migrations and drops
only its own database afterward. The PostgreSQL test role requires CREATEDB;
the baseline contains public-qualified enums, so schema isolation is insufficient. It tests database state, replay, refresh/logout/
revoke-all concurrency, ownership, safe projections, signing rollback, expiry,
canonical account restrictions and migration rollback. The unchanged CI workflow does not explicitly run this suite with
`PG_INTEGRATION_URL`; it skips during the default unit run. Run the command
above explicitly for integration evidence before reviewing session changes. No production credentials
are needed. SMTP uses local Mailpit; OAuth/S3/Resend/OpenRouter calls need real
credentials only when testing those external services.
