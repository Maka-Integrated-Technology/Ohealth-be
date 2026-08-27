# OHealth Server documentation

These documents define the server architecture that code and future agent work
must follow.

## Documents

1. [Architecture](./01-architecture.md) — system boundaries, runtime components,
   and dependency direction.
2. [Identity and access](./02-identity-and-access.md) — registration, verification,
   sessions, MFA, and authorization.
3. [Domain model](./03-domain-model.md) — users, personas, professional profiles,
   organizations, and memberships.
4. [Queues and Redis](./04-queues-and-redis.md) — challenge state, caching,
   transactional outbox, BullMQ, and worker rules.
5. [Rework plan](./05-rework-plan.md) — implementation order and removal of the
   legacy architecture.

## Documentation status labels

- **Implemented** means code, schema, and tests exist in this repository.
- **Foundation** means the schema or contract exists but runtime behaviour is not
  complete.
- **Target** means an approved design that still needs implementation.
- **Legacy** means code may still compile but must not be extended.

## Current status

| Area                               | Status     |
| ---------------------------------- | ---------- |
| User personas                      | Foundation |
| Organization memberships           | Foundation |
| Legal acceptance records           | Foundation |
| Transactional outbox table         | Foundation |
| Role-free registration contracts   | Foundation |
| Redis authentication challenges    | Target     |
| Distributed rate limiting          | Target     |
| BullMQ email worker                | Target     |
| Rotating refresh-token families    | Target     |
| Encrypted MFA factors              | Target     |
| Existing role-array authentication | Legacy     |

Update this table whenever an area moves between statuses.
