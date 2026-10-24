# Canonical account lifecycle and access policy (Issue #74)

## Source of truth

`users.account_status` and `users.email_verified_at` determine account access.
Legacy `is_active` / `is_verified` are derived compatibility fields, synchronized
in every account-status mutation and guarded by a database check constraint.
They must **never** override account status or verified-contact timestamps.
Unsupported/null statuses cause migration failure or a fail-closed authorization.

## State and transition matrix

| State | Login/OAuth/refresh/JWT/protected | Verify email code | Admin transitions |
| --- | --- | --- | --- |
| `pending_verification` | Denied | Can activate after correct unexpired code | suspended, deactivated |
| `active` + `email_verified_at` | Allowed | Already verified | suspended, deactivated |
| `active` without timestamp (invalid) | Denied | Denied | disallowed until repaired |
| `suspended` | Denied | Denied | active only if verified, deactivated |
| `deactivated` | Denied | Denied | none (terminal state) |
| Unrecognized status | Denied; migration fails | Denied | Denied |

State `disabled` from the issue is implemented as the existing `deactivated`
value, which is a permanent disabled state. Introducing a new string value is
an explicit future migration, not an implicit alias.

Password signup now returns only the pending user, verification routing and a
message. **No JWT, refresh token or session is issued before email proof.**
Successful `POST /auth/verify` consumes the code and activates the account
transactionally, then returns the **first** authenticated session and routing
data. After verification, clients should store the returned tokens. This is an
intentional client contract change requiring coordinated consumer releases.

New Google accounts can be marked verified only on successful validation of a
Google-signed ID token containing a verified email claim. Existing pending,
suspended or deactivated accounts cannot be activated via Google login.
Subject mismatch during Google account linking is rejected.

Laboratory and organization administrators are created as
`pending_verification` with `email_verified_at = NULL`, an expiring
purpose-bound email verification code, and **no credentials**. The challenge
is emailed after the creation transaction. Their first session is returned
only after proving email ownership via `POST /auth/verify`.
Existing laboratory staff invitation acceptance remains a distinct
purpose-bound token flow; possession of the emailed invitation token is the
required contact proof for accepting the invite.

## Authorized transitions and audit

Email verification: `pending_verification -> active` using valid, unexpired
code. The user row is pessimistically locked and the code consumption,
canonical status/timestamp update and history insert are a single DB transaction.

Administrative transitions: only callers passing an `ADMIN` actor and nonblank
reason to the internal service may suspend, deactivate or reinstate verified
suspended accounts. There is **no public state-change endpoint**. Any future
administrative HTTP surface must require authenticated admin authorization,
record reason/actor, and be security reviewed before exposure.

`user_account_status_history` records the former state, new state, actor,
reason, and timestamp; the migration records changed legacy rows too.

## Migration and rollout

Apply new migration `1792750000000-CanonicalAccountLifecycle` on staging with
a database backup first. Do not edit `1787870806542-InitialSchema.ts`.
Backfill rules: preserve explicit `suspended`/`deactivated`; a legacy account
can be active or deactivated only if both its old verified flag and an
**existing non-null email verification timestamp** support that state. Never
fabricate verification timestamps from `created_at`/`updated_at` or
administrative account creation. Accounts with no recorded proof become
`pending_verification` even if old flags claimed verified. This may require
existing users and administrators to resend/complete verification. Back up and
review the affected account counts before production deployment.
The migration rejects unknown status values and prevents subsequent drift.
Its automatic rollback intentionally fails because the backfill is lossy.

The CI integration suite exercises the **actual PostgreSQL migration SQL**
with historical flag combinations, status audit, constraints, invalid values,
and one-time code consumption. This is synthetic integration data, **not**
evidence that the migration has been tested on a staging copy of production.

Verification checklist on staging PostgreSQL:
- Run migrations on a copied database containing every status/legacy combination.
- Repeat migration check with an unsupported status (expect failure).
- Verify a valid email code concurrently twice (exactly one transition and audit).
- Test login, Google login, refresh, and protected endpoints for each status.
- Suspend a user with a valid existing JWT; request must immediately return 401.
- Verify revocation remains in effect on refresh and password reset.
- Verify admin transition audit and denial for nonadmin/blank reason.
- Inspect API clients and onboarding for unexpected contract changes.

## Deprecation plan

1. Current release: status + timestamp authoritative; legacy flags written in lockstep
   and checked in PostgreSQL; external reads supported temporarily.
2. Next release: migrate all integrations and consumers to canonical status.
3. Later migration: remove legacy fields and constraint after observing no callers.
