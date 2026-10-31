# Canonical refresh sessions — #77

The session service is now registered in the live auth module. Login,
post-verification issuance, organization/laboratory sign-in and the existing
Google issuer use opaque rotating refresh credentials. This implements the
session boundary from `02-identity-and-access.md`; OAuth linking, persona
migration and MFA remain their own issues.

## Security and concurrency

- Refresh secrets contain 256 random bits. Persist only SHA-256 verifiers;
  do not decode opaque credentials as JWTs. No refresh signing secret is needed.
- One stable `auth_sessions.session_id` identifies a family. Version 2 marks
  canonical sessions; consumed verifiers remain in `auth_refresh_credentials`.
- Rotation locks user then session in one transaction, consumes the verifier,
  stores its replacement and signs the access JWT. Signing/audit failure rolls
  back the entire mutation. Absolute family expiry never slides on refresh.
- Replaying any consumed verifier commits family revocation **before** returning 401. Parallel refresh calls may cause replay revocation; clients must serialize
  refresh and must not retry a lost response with the consumed credential.
- JWTs contain only `sub`, `sid`, `jti`, `iat`, `exp`. Verification permits HS256
  only and requires UUID identity/session/token identifiers. Legacy JWTs without
  session identity are rejected. Current roles come from the database for the
  compatibility period until #80; token-supplied roles never grant access.
- Protected-request validation is one joined MVCC read of user and session.
  It takes **no row write locks**. Account state, verified-contact timestamp,
  ownership, credential version, revocation and absolute expiry are checked
  together. Requests beginning after a revocation commits are rejected; already
  in-flight requests do not gain retroactive cancellation.
- Issuance, rotation, logout, password change and reset serialize through the
  user lock. Login rechecks the password-hash snapshot under that lock, so proof
  invalidated by a concurrent reset cannot create a new session.
- Password change updates the credential and revokes all sessions in one
  transaction. The merged #75 challenge-recovery transaction already holds the
  user lock and revokes all persisted sessions; the new JWT guard now enforces
  that revocation for access tokens as well as refresh credentials.
- Issuance, rotation, replay, logout and password-change events use the shared
  #81 transactional audit service. Recovery keeps #75's existing event. Audit
  writes fail the security transaction rather than being silently dropped.

## HTTP contract and transport

All paths are under `/api/auth`:

- `POST refresh`: accepts a 43-character base64url opaque `refresh_token`.
- `POST logout`: authenticated; `session_id` must match the bearer session.
- `GET sessions`: returns only owned active sessions' ID, creation, last refresh
  and absolute expiry times. No token hash, email, IP or user-agent is exposed.
- `POST sessions/revoke`: authenticated; accepts one owned `session_id`.
  Unknown/foreign IDs are indistinguishable no-ops.
- `POST sessions/revoke-all`: revokes all sessions of the authenticated caller,
  including the current one. No client-supplied user ID is accepted as authority.

The existing explicit token-in-body transport is retained for native/API clients;
store refresh credentials in OS secure storage. There is no cookie-authenticated
refresh endpoint in this change. Browser adoption requires an HTTP-only secure
cookie boundary and explicit CSRF controls (for example a same-origin BFF); do
not put refresh secrets into localStorage or expose them to browser scripts.
Browser transport integration and #114 staging/client rollout evidence remain
release prerequisites, not permission to deploy an unvalidated client migration.

## Startup and cutover

`JWT_SECRET` is required, at least 32 characters and generated securely.
`TOKEN_ACCESS_DURATION` is required, 1–900 seconds. `TOKEN_REFRESH_DURATION` is
required, 1–2,592,000 seconds (30 days). Values accept seconds or `s/m/h/d` units.
Invalid/missing settings abort application startup; there are no fallback secrets
or durations. `JWT_REFRESH_SECRET` is obsolete and can be removed after rollback
planning. Contract generation uses Nest preview and does not need live secrets.

The additive foundation migration leaves existing rows as version 1. The new
cutover migration revokes every version-1 session. Do not edit the applied
baseline. Deploy in a coordinated maintenance window: migrate, stop old issuers,
start canonical API instances, and require reauthentication. Mixed old/new
issuance or old JWT validators are unsupported. Communicate the opaque refresh
contract and mandatory reauthentication to all clients before rollout.

Rollback never restores revoked sessions. A rollback to legacy code requires a
separately reviewed release plan; it must not resurrect old refresh credentials.
Review the generated OpenAPI/client diff and obtain any required breaking-API
approval separately from code review. This branch does not bypass either gate.

## Retention

User deletion cascades to sessions and verifier history. Retain consumed
verifiers until the family's absolute expiry; deleting them earlier defeats
replay detection. Expired version-2 families may be deleted after an additional
15 minutes (the maximum access lifetime), cascading history deletion. Configure
an operator cleanup schedule before production; this change does not introduce a
new background worker. Security audit retention/deletion follows the shared
#81 policy and remains separate from credential-history cleanup. Never log or
export refresh verifiers, raw credentials or clinical data.

## Verification without workflow changes

The existing PostgreSQL CI entry point
`canonical-account-lifecycle.integration.spec.ts` imports the session suite.
The existing live challenge HTTP/PostgreSQL suite also tests real session
issuance, JWT guard enforcement, cross-instance replay, ownership, suspension,
logout, password change and reset/refresh concurrency. Neither suite mocks the
session service or JWT verifier. SMTP and routing are isolated substitutes.

No `.github/workflows` file is changed. Default unit tests skip database suites
when `PG_INTEGRATION_URL` is absent. The existing explicit hosted PostgreSQL
commands supply it and execute the registered tests; connection/setup failures
fail rather than producing a successful skipped run.

```sh
npm ci --ignore-scripts
# PostgreSQL role needs CREATEDB for the disposable session-test database.
PG_INTEGRATION_URL=postgres://postgres:postgres@localhost:5434/app_db \
  npx jest --runInBand src/database/tests/canonical-account-lifecycle.integration.spec.ts
PG_INTEGRATION_URL=postgres://postgres:postgres@localhost:5434/app_db \
  npx jest --runInBand src/database/tests/auth-challenge-live-http.integration.spec.ts
npm test -- --runInBand
npm run build
npm run contract:check
npm run api-client:test
```

The session suite runs actual migrations in a disposable database because the
baseline contains public-qualified enums. It tests parallel validation under a
held write lock, committed suspension/revocation, replay, refresh/logout/revoke-all
races, cross-user ownership, absolute expiry, stale password proofs, rollback and
migration safety. Database names/schemas are unique and only test-owned resources
are dropped. No production credentials are needed for these checks.
