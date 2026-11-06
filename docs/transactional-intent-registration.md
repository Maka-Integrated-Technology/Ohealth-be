# Transactional intent registration (Issue #78)

`POST /auth/signup` accepts only the closed `SignupIntent` contract documented
in [Identity and access](./02-identity-and-access.md). It no longer accepts a
persisted role, organization type, account status, or activation flag.

## Atomic records

One PostgreSQL transaction creates the pending user and all required onboarding
state:

- patient intent: patient persona and patient profile;
- healthcare-professional intent: healthcare-professional persona;
- pharmacy, laboratory, or hospital intent: pending organization and active
  owner membership;
- terms-of-service and privacy-policy acceptance evidence;
- purpose-bound contact challenge, encrypted delivery envelope, and security
  audit event; and
- an HMAC-only retry receipt when an `Idempotency-Key` is supplied.

Failure at any step rolls the transaction back. Delivery readiness is checked
before password hashing and again inside the transaction. Signup returns only
pending challenge metadata; session credentials are issued atomically with
successful contact verification.

## Configuration and retry semantics

Set `REGISTRATION_TERMS_VERSION`, `REGISTRATION_PRIVACY_VERSION`, and a secret
`REGISTRATION_IDEMPOTENCY_PEPPER` of at least 32 UTF-8 bytes. Startup fails when
any value is missing. Rotate legal versions only with coordinated client and
content releases. Rotating the pepper intentionally invalidates retry keys from
the prior deployment.

Clients may send a UUID-v4 `Idempotency-Key`. An identical retry while the
account is still pending returns its current active contact challenge. Reusing
the key with different input, after activation, or without a live challenge
returns `409`. Never derive the key from an email or another user identifier.

`registration_attempts` stores only HMAC digests and foreign keys. Schedule:

```bash
npm run registration-retries:prune -- --batch-size=200
```

at least hourly until it reports zero removals. Receipts older than 24 hours are
deleted; identity, consent, audit, and challenge evidence are retained under
their own policies.

## Migration and rollout

Migration `1793600000000-TransactionalIntentRegistration` preserves existing
accounts, adds normalized unique indexes, and fails closed if historical
case/whitespace collisions exist. Before production rollout:

1. run the migration against a recent database copy;
2. reconcile any reported normalized email or registration-number collision;
3. deploy a healthy challenge-delivery worker before enabling API traffic;
4. configure the legal versions and independent idempotency pepper;
5. release consumers using intent, legal versions, and the pending response;
6. monitor registration `409` rates and delivery-worker health; and
7. schedule retry-receipt pruning.

Known repository consumers must be released against the generated contract:

- `OHealthPlus-mobile/features/auth/services/auth.ts` and its signup screen still
  send the legacy `role` payload and expect immediate credentials;
- `ohealth-dashboard/app/features/auth/api.ts` still sends the legacy role/name
  contract and its session notes describe signup as returning tokens.

Those consumers must send an intent and the two configured legal versions, then
hold only the pending challenge response until verification returns the first
session. This backend change therefore requires the repository's documented
breaking-contract approval before merge.

Rollback drops only the retry table and the two additive normalized indexes.
It does not delete accounts or onboarding records already created. Rolling the
API back after accepting new intent registrations still requires coordinated
consumer handling because the public signup contract is intentionally breaking.
