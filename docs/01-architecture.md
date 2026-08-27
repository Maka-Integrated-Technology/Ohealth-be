# OHealth Server architecture

## Purpose

OHealth is a healthcare platform shared by a patient mobile application and a
management dashboard. It must support individual patients, independent
healthcare professionals, healthcare organizations, organization staff, and
platform operators without treating those concepts as one global user role.

## Architecture goals

- One human identity across mobile and dashboard surfaces.
- Strict organization isolation for hospitals, laboratories, and pharmacies.
- Separate healthcare persona data from authorization.
- Reliable asynchronous email, notification, document, and audit processing.
- Revocable, observable, and abuse-resistant authentication.
- Explicit protection and retention rules for personal and clinical data.
- A modular monolith that can be split only when operational evidence justifies
  it.

## Logical architecture

```text
Patient Mobile App       Management Dashboard       Internal Operations
          |                        |                         |
          +------------------------+-------------------------+
                                   |
                              NestJS API
                                   |
       +---------------------------+---------------------------+
       |                           |                           |
 Identity & Access          Healthcare Domains          Platform Services
 users, personas,           patients, professionals,    outbox, audit,
 sessions, membership       bookings, organizations     email, storage
       |                           |                           |
       +---------------------------+---------------------------+
                                   |
                    PostgreSQL / Redis / Object Storage
                                   |
                         BullMQ Worker Processes
                                   |
                      Email / Push / External Services
```

## Runtime components

### API process

The API validates requests, enforces identity and organization permissions,
executes short database transactions, and returns deterministic responses. It
does not perform slow email delivery or bulk processing inline.

### Worker process

Workers consume BullMQ jobs, perform retryable side effects, and update durable
delivery state. Workers use the same domain contracts as the API but run as a
separate process with graceful shutdown.

### PostgreSQL

PostgreSQL is the source of truth for identities, profiles, organizations,
memberships, sessions, legal acceptances, audit records, outbox events, and
healthcare domain records.

### Redis

Redis stores ephemeral security challenges, distributed rate-limit state,
session-revocation acceleration, permission caches, idempotency keys, and BullMQ
data. Security, cache, and queue responsibilities use separate credentials and
prefer separate production instances.

### Object storage

Documents and media live in private S3-compatible storage. PostgreSQL stores
metadata and object keys, not file contents. Download access is authorized before
a short-lived signed URL is issued.

## Module boundaries

- Identity modules may depend on shared infrastructure but not on dashboard or
  mobile routing concepts.
- Domain profiles reference a user identity; they do not own passwords or
  sessions.
- Organization permissions are resolved through memberships.
- Email transport does not decide business eligibility. Domain services decide
  whether a message should exist and write an outbox event.
- Workers do not bypass domain authorization to mutate unrelated records.
- Shared helpers must not become a second domain-service layer.

## API principles

- Public DTOs never expose writable role, permission, verification, ownership,
  or account-status fields.
- Authentication responses describe available contexts rather than frontend
  routes.
- Errors use stable machine-readable codes and safe human messages.
- Mutations that may be retried accept or derive an idempotency key.
- Organization resources are addressed and authorized explicitly.

## Current architectural debt

The existing authentication module still combines identity, role, verification,
frontend routing, and session issuance. The existing `users.role` array and raw
verification/reset columns are legacy. They may be removed during this rework;
new code must use personas, memberships, challenges, and sessions defined by the
target architecture.
