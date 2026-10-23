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

Existing password signup retains its current response contract (including
initial onboarding tokens), but pending accounts cannot refresh those tokens or
use them on protected endpoints. Contact verification remains a public,
rate-limit-protected action; product/API owners should remove unnecessary
signup tokens in a separate compatibility-reviewed contract change.

New Google-verified users and organization/laboratory-created verified users
are recorded as active with `email_verified_at` in the same insert. Google
login **does not** silently reactivate a pending/suspended/deactivated existing
account. Account linking also refuses an existing, different Google subject.

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
Backfill rules, in order: preserve explicit `suspended`/`deactivated`;
verified + active legacy flags -> active; verified + inactive -> deactivated;
all others -> pending. Verified timestamp backfilled from existing timestamps.
Review false-positive deactivations before production migration.
The migration rejects unknown status values and prevents subsequent drift.
Its automatic rollback intentionally fails because the backfill is lossy.

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
