# Authentication security audit foundation (Issue #81, incremental PR)

This change lays down shared infrastructure. **It does not mark Issue #81
complete** and it does not claim that login, OAuth, refresh or MFA flows
already emit events. Implementation issues #75–#80 and #82 must add their
own producer calls and regression tests.

## Design

- Dedicated `auth_security_events` table, separate from the application's
  HTTP logger and `outbox_events` delivery pipeline.
- Explicit event type and outcome allowlists, with actor, subject and session
  identifiers as optional UUIDs and an allowlisted request source.
- No free-form event payload or arbitrary metadata, email, IP, user agent,
  request/response body, reset code, password, token, MFA secret or error text.
- The API accepts no untrusted event properties beyond the allowlisted
  schema. The service constructs the insert object explicitly.
- Unknown-account sign-in attempts must omit subject/actor IDs rather than
  resolving the account for logging. Do not try to make audit telemetry
  distinguishable to callers.
- The storage interface only inserts. Database triggers additionally reject
  UPDATE, DELETE and TRUNCATE operations against audit evidence, including
  SQL paths that bypass the service. Privileged schema owners can still alter
  database objects; this is an integrity guard, not tamper-proof storage.
  Formal retention and administrative deletion need a separately approved
  policy and migration; **do not turn off audit writes silently**.

## Transaction boundary

`AuthSecurityAuditService.recordInTransaction(manager, event)` requires
an **active** TypeORM transaction; use the *same* `EntityManager` as the
authentication state mutation. Audit insert failure propagates, allowing
the mutation and event to roll back together. Never call this after
committing a security-critical mutation and assume it is atomic.

For standalone attempts with no state mutation (such as a failed login),
`recordAttempt(event)` creates its own database transaction. Failures
are deliberately **not swallowed**. Every future producer must define
its public failure behavior, monitoring/escalation and retry policy;
a future outbox may be used for reliable noncritical notifications, but
it cannot replace a required transactional security audit record.

## Implementation handoff

`AuthModule` imports `AuthSecurityAuditModule` so its controllers and
providers can inject `AuthSecurityAuditService`. Other feature modules
must explicitly import `AuthSecurityAuditModule` before using the service.

Each dependent issue should add **event emission and transaction-backed
tests**, not create a parallel audit table or a second logger:

- #75: contact verification, resend, recovery, rate limit and replay.
- #76: sign-in success/denial and password-policy errors (after its PR merges).
- #77: session refresh, replay, logout, revocation and reset.
- #78: signup intent, idempotency, rollback and duplicate registration.
- #79: OAuth identity link, blocked-account and takeover attempts.
- #80: persona and membership policy denial/authorization.
- #82: MFA enrollment, challenge, recovery, lockout and revocation.

Issue #81 closes **only** when the complete integrated E2E matrix passes.
The PostgreSQL integration suite in this foundation confirms actual migration
constraints, immutable audit rows, standalone attempt commits, persistence
across database connections, transaction rollback and safe stored columns;
it does not replace
auth endpoint-to-database E2E tests.

## Deployment and approvals

Run the additive migration on a backed-up staging copy first. This migration
deliberately refuses automatic rollback because that would erase security
evidence. Operators must approve a retention and archival policy before any
production cleanup. No controller, public route, API contract or client change
is added by this foundation.
