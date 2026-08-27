# Authentication architecture rework plan

This is a replacement, not a permanent parallel authentication system. Legacy
code may be deleted or rewritten when its replacement is ready. Existing user
data must still be migrated deliberately and audited before destructive schema
changes.

## Completed foundation

- Account lifecycle enum and verification timestamp.
- Patient and healthcare-professional personas.
- Organization membership entity and constraints.
- Legal acceptance records.
- Transactional outbox entity.
- Registration-intent and authentication-challenge DTO contracts.
- Architecture documentation and repository agent guide.

## Implementation order

### 1. Infrastructure

- Add validated Redis configuration and separate security/cache/queue clients.
- Add Redis-backed distributed throttling.
- Add BullMQ and dedicated worker entrypoint.
- Implement outbox claiming, publishing, retries, and redacted failure handling.

### 2. Registration and verification

- Implement the role-free registration application service.
- Create users, personas or organization ownership, legal acceptance, challenge,
  and outbox event transactionally.
- Implement atomic challenge verification and resend controls.
- Issue no normal session before verification.

### 3. Sessions and login

- Replace existing session issuance with short access tokens and opaque rotating
  refresh tokens.
- Add refresh families, reuse detection, device-safe session metadata, listing,
  and revocation.
- Remove backend frontend-routing decisions from authentication responses.

### 4. MFA and recovery

- Replace plaintext MFA storage with encrypted factor records.
- Store recovery codes as individual hashes.
- Require step-up authentication for sensitive account and permission changes.
- Require MFA for privileged accounts.

### 5. Organization authorization

- Resolve active organization through session context and membership.
- Replace organization-admin lookup tables and global organization roles with
  membership checks where appropriate.
- Add permission cache and complete invalidation paths.

### 6. Client adoption

- Update dashboard registration, verification, login, organization selection,
  and recovery flows.
- Update the mobile application to use the same identity and session contracts.
- Test one user with both personas and multiple organization memberships.

### 7. Legacy removal

After production data reconciliation and client adoption:

- delete the global `users.role` field and related guards;
- delete raw verification and reset columns;
- delete the existing frontend-routing service;
- delete obsolete organization-specific admin identity flows;
- replace existing MFA and session tables;
- remove compatibility DTOs, endpoints, tests, and messages;
- update `docs/README.md` status labels to match implementation.

## Migration safety

- Never discard production identities or clinical records merely because code is
  being rewritten.
- Backfill personas from patient/professional profiles, using legacy roles only
  as a secondary migration hint.
- Backfill organization memberships from verified organization ownership and
  administrator records.
- Generate reconciliation reports for unmatched or ambiguous accounts.
- Run migrations in staging with a production-like anonymized dataset.
- Take a verified backup and document rollback before destructive production
  migrations.

## Definition of done

The rework is complete when dashboard and mobile clients use the replacement
flows, privileged users use MFA, refresh-token reuse is detected, all
organization access is membership-scoped, authentication email delivery is
durable, legacy auth fields and services are removed, and the documentation
status table contains no legacy authentication dependencies.
