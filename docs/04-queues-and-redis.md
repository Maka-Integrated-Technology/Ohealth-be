# Queues and Redis architecture

## Current status

The transactional outbox table is a foundation. Redis, BullMQ queues, dedicated
workers, and distributed rate limiting are approved targets but are not yet
implemented in OHealth Server.

## Redis responsibilities

Use separate logical clients and preferably separate production instances:

| Responsibility      | Example data                                  | Eviction policy          |
| ------------------- | --------------------------------------------- | ------------------------ |
| Security            | challenges, attempts, revocation, rate limits | no unexpected eviction   |
| Authorization/cache | membership permissions, safe reference data   | bounded eviction allowed |
| Queue               | BullMQ jobs and schedules                     | no eviction              |

All connections require TLS where supported, private networking, authentication,
least-privilege ACLs, namespaced keys, monitoring, and memory alerts.

## Key conventions

```text
auth:challenge:{challengeId}
auth:resend:{identityHash}:{purpose}
auth:rate:{dimension}:{valueHash}
auth:session:{sessionId}
auth:revoked:{sessionId}
rbac:{organizationId}:{userId}
idempotency:{scope}:{keyHash}
```

Never put raw email addresses, OTPs, reset tokens, MFA secrets, clinical data, or
other credentials in key names.

## Transactional outbox

When a database change requires an external side effect, the domain transaction
writes an outbox event in the same PostgreSQL transaction. A publisher claims
pending events and enqueues BullMQ jobs.

The outbox event contains identifiers and non-sensitive metadata. For an
authentication email, the queue job should carry a message or challenge
reference, not the raw code. If delivery temporarily requires recoverable secret
material, store it encrypted in a purpose-built short-lived store and delete it
after dispatch.

## Initial queues

| Queue           | Purpose                                                        |
| --------------- | -------------------------------------------------------------- |
| `email`         | verification, reset, invitation, security alerts               |
| `audit`         | non-blocking enrichment/export of already durable audit events |
| `notifications` | push and in-app notification fan-out                           |
| `documents`     | reports, receipts, exports, and document processing            |

Security audit durability must not depend solely on Redis. The authoritative
event is committed to PostgreSQL before asynchronous enrichment.

## Job rules

- Every job is idempotent.
- Every job has a stable correlation ID.
- Retry transient errors with bounded exponential backoff.
- Validate referenced records again in the worker.
- Set concurrency and provider rate limits explicitly.
- Do not retain completed or failed jobs indefinitely.
- Dead-letter records contain redacted metadata, never the original secret
  payload.
- A final failure produces an operational alert without personal or clinical
  payloads.

## Process model

API and worker processes use the same application modules but separate
entrypoints. The worker does not expose the public API. Shutdown stops accepting
new work and drains in-flight jobs before process exit.

## Failure behaviour

- Redis unavailable during a security check: fail closed with a controlled
  temporary-service response.
- Queue unavailable after an outbox commit: the outbox publisher retries; the
  domain transaction remains durable.
- Email provider unavailable: BullMQ retries and eventually records a redacted
  terminal failure.
- Permission cache unavailable: resolve from PostgreSQL or deny; never grant on
  cache failure.

## Observability

Track queue depth, oldest job age, retry count, terminal failures, challenge
failure rates, resend rates, authentication throttling, and Redis memory. Logs
contain correlation ID, job ID, event type, safe internal identifiers, attempt,
duration, and outcome.
