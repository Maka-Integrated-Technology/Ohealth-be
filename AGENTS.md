# OHealth Server — Agent Working Guide

## What this repository is

OHealth Server is the NestJS backend shared by the OHealth mobile application
and management dashboard. It serves patients, healthcare professionals,
healthcare organizations, and platform operators.

Stack: NestJS 11, PostgreSQL, TypeORM, object storage, email delivery, and a
planned Redis and BullMQ runtime for security state and background work.

The identity and authentication architecture is being rebuilt. Do not extend
the legacy role-array authentication design simply because some of its code is
still present. Read the architecture documents before changing authentication,
authorization, onboarding, users, organizations, professionals, patients,
sessions, email delivery, or background jobs.

## Required reading

| Work area                                               | Read first                       |
| ------------------------------------------------------- | -------------------------------- |
| Any architectural change                                | `docs/01-architecture.md`        |
| Authentication, sessions, OTP, MFA, permissions         | `docs/02-identity-and-access.md` |
| Users, personas, professionals, patients, organizations | `docs/03-domain-model.md`        |
| Redis, BullMQ, email, outbox, workers                   | `docs/04-queues-and-redis.md`    |
| Schema replacement or migration                         | `docs/05-rework-plan.md`         |

`docs/README.md` is the documentation index and implementation-status summary.

## Source-of-truth order

When sources disagree, use this order:

1. Executable migrations and entity constraints.
2. The architecture documents listed above.
3. Application services and tests.
4. API documentation and design files.
5. Legacy code comments.

If the code intentionally changes an architectural rule, update the relevant
document in the same change. Never silently let documentation and code diverge.

## Core architecture rules

- `User` is an organization-neutral human identity.
- Patient and healthcare-professional personas describe how a human uses the
  platform. They are not authorization roles.
- Doctor, nurse, counsellor, nutritionist, and similar labels belong to the
  professional profile and speciality model.
- Hospital, laboratory, and pharmacy are organization types.
- Organization access comes from `OrganizationMembership` and is always scoped
  to one organization.
- The organization creator receives an `owner` membership. The user is not an
  “owner account type.”
- Public registration accepts an intent, never a role or permission.
- Platform-level privileges are separate from personas and organization roles.
- Never trust a role, organization ID, verification state, price, or ownership
  claim supplied by a client without server-side resolution.

## Security rules

- Never issue a normal application session before required email verification.
- Store passwords with the approved password hasher and support algorithm
  migration; never log passwords or password hashes.
- OTP, reset, invitation, and MFA challenges are single-purpose, short-lived,
  attempt-limited, rate-limited, and atomically consumed.
- Never store a raw OTP or reset token in PostgreSQL, logs, audit events, outbox
  payloads, failed-job payloads, or analytics.
- TOTP secrets are encrypted at rest. Recovery codes are cryptographically
  generated and stored only as hashes.
- Access tokens are short-lived. Refresh tokens rotate, are stored only as
  hashes, and support family-wide reuse detection and revocation.
- Organization permission checks fail closed and include the active
  organization in every cache key and database query.
- Authentication responses must not reveal whether an email address exists.
- Sensitive mutations produce durable security audit events containing
  identifiers and safe metadata, never credentials or protected health data.

## Data protection rules

- Treat medical conditions, clinical notes, test results, prescriptions,
  diagnoses, vitals, and appointment content as protected health data.
- Logs and alerts are pointers, not payload stores. Log correlation IDs,
  internal identifiers, event names, and safe status metadata only.
- Every new table containing personal or clinical data needs an explicit
  retention and deletion decision.
- Object-storage keys are private by default. Access is granted using short-lived
  signed URLs after authorization.
- Never place protected health data in Redis cache or queue payloads unless the
  design explicitly requires it, documents the retention, and encrypts it.

## Project layout

```text
src/
  common/             shared guards, filters, interceptors, and types
  config/             application configuration
  database/           TypeORM data source, migrations, and seeds
  modules/
    auth/              authentication contracts and current auth implementation
    identity/          personas and legal acceptance records
    user/              human identities
    patient/           patient profile and clinical-facing patient data
    professional/      healthcare professional profile and operations
    speciality/        professional disciplines and specialities
    organization/      hospitals, laboratories, pharmacies, and memberships
    platform-events/   transactional outbox foundation
    email/             email rendering and transport
    storage/           private object storage
docs/                  architecture and operating decisions
```

## Implementation status

The repository currently contains legacy authentication code alongside the
replacement foundation. Legacy fields such as `users.role`, raw verification
columns, raw reset columns, and the existing MFA storage are not approved target
patterns. Do not add new consumers of those fields.

The replacement foundation currently includes:

- account lifecycle state;
- user personas;
- organization memberships;
- versioned legal acceptance records;
- transactional outbox records;
- role-free registration and authentication challenge contracts.

Redis challenge execution, BullMQ workers, rotating refresh-token families, and
encrypted MFA factors are documented targets and must not be described as
implemented until code and tests exist.

## Development conventions

- Keep controllers thin and place transactional rules in application services.
- Use DTOs with `class-validator`; the global validation pipe rejects unknown
  properties.
- Use TypeORM transactions for changes that must succeed or fail together.
- Every organization-scoped query must include an organization predicate.
- Queue jobs must be idempotent because retries are expected.
- Use migrations; never enable TypeORM synchronization.
- Do not edit an existing applied migration. Add a new migration.
- Add tests for security boundaries, not only successful responses.

## Common commands

```bash
npm run build
npm test -- --runInBand
npm run test:e2e
npm run format:check
npm run migration:show
npm run migration:run
```

Before finishing a change, run the smallest relevant tests, the build, and then
the full unit suite when the change touches shared identity or authorization.

## Before opening a pull request

State whether the change affects authentication, authorization, organization
isolation, protected health data, credentials, retention, email delivery, or
background jobs. Name the relevant architecture document and describe how the
change was verified.
