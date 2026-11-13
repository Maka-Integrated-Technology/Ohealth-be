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
6. [Canonical refresh sessions](./canonical-refresh-sessions.md) — rotation,
   replay detection, revocation, migration and retention behaviour.
7. [Password login-code verification](./login-code-verification.md) —
   purpose-bound pre-session proof and client migration contract.
8. [Transactional intent registration](./transactional-intent-registration.md)
   — atomic personas, organizations, legal acceptance, retries, and rollout.
9. [Authentication challenge continuation](./auth-challenge-continuation.md)
   — handle-bound resend, lineage, stable errors, and recovery links.
10. [Public discovery contract](./public-discovery-contract.md) — public route
    boundary, visibility policy, query conventions, and response allowlists.

## Documentation status labels

- **Implemented** means code, schema, and tests exist in this repository.
- **Foundation** means the schema or contract exists but runtime behaviour is not
  complete.
- **Target** means an approved design that still needs implementation.
- **Legacy** means code may still compile but must not be extended.

## Current status

| Area                               | Status      |
| ---------------------------------- | ----------- |
| User personas                      | Implemented |
| Organization memberships           | Implemented |
| Legal acceptance records           | Implemented |
| Transactional outbox table         | Foundation  |
| Role-free registration contracts   | Implemented |
| Redis authentication challenges    | Target      |
| Distributed rate limiting          | Target      |
| BullMQ email worker                | Target      |
| Rotating refresh-token families    | Implemented |
| Browser refresh-cookie transport   | Foundation  |
| Encrypted MFA factors              | Target      |
| Public discovery contract          | Foundation  |
| Public speciality catalogue        | Implemented |
| Existing role-array authentication | Legacy      |

Update this table whenever an area moves between statuses.
