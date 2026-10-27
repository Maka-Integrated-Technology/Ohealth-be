# Identity and access architecture

## Identity model

`User` represents one human being and is not owned by an organization. A user
may have a patient persona, healthcare-professional persona, or both. The same
user may belong to several organizations with different permissions in each.

Authorization is resolved from three independent dimensions:

1. Platform privilege for rare internal OHealth operators.
2. Organization membership for organization-scoped access.
3. Resource relationships for patient, professional, booking, or clinical-data
   access.

A persona is never sufficient authorization by itself.

## Registration intents

Public registration accepts exactly one initial intent:

- `patient`
- `healthcare_professional`
- `organization`

The intent creates onboarding state, not a client-selected authorization role.
Organization registration creates the organization and an `owner` membership for
the registering human in the same transaction.

## Registration flow

1. Normalize the email and validate the password and legal-document versions.
2. Create the user in `pending_verification` state.
3. Create the requested persona, or the organization and owner membership.
4. Record terms and privacy-policy acceptance.
5. Create an authentication challenge and a non-sensitive outbox event.
6. Commit all durable records atomically.
7. Deliver the verification message asynchronously.
8. Return the challenge identifier, masked destination, expiry, and resend wait.

Registration does not return an ordinary access or refresh token.

## Registration retry safety (internal foundation)

The internal registration transaction can accept an optional server-supplied
idempotency key (UUIDv4) until the reviewed public signup contract is ready.
The calling controller must generate or validate a high-entropy request key
and preserve it for retransmission of the **same** registration payload.
`REGISTRATION_IDEMPOTENCY_PEPPER` must be a secret random value of at
least 32 UTF-8 bytes, stored in deployment secret management. Do not share
it with the frontend or reuse the challenge pepper.

The database persists only an HMAC of the retry key and a separate keyed HMAC
of canonical request data (including the password), plus pending challenge
receipt metadata. No raw key, password, verification code or token is stored
in the journal. Advisory transaction locks serialize races on one key.
A replay with the identical payload, within the original challenge lifetime
and while the account is pending, reuses the same masked pending response
**without creating a new user, challenge, acceptance, or outbox event**.

Reusing the key with different details or after challenge expiry returns 409.
The existing verified resend/recovery flow must handle expired challenges;
registration retries must not silently create a replacement challenge.
Different keys competing to register the same normalized email still yield
a controlled unique-constraint conflict. A writer/outbox failure rolls back
the retry record together with identity and legal acceptance data.

**Retention and cleanup:** keep a retry receipt for 24 hours after the
original challenge expires, then remove only the `registration_attempts`
row. This is the chosen retention policy for this HMAC-only journal.
Never delete the corresponding user, acceptance records, delivery outbox,
challenge, or audit history through retry maintenance. Run the bounded
cleanup command in the trusted operations environment (not an HTTP route):

```bash
npm run registration-retries:prune
npm run registration-retries:prune -- --batch-size=250
```

Each invocation deletes at most 500 expired receipt rows, uses
`FOR UPDATE SKIP LOCKED` so it does not block in-flight retries, and
reports only an aggregate count. For a backlog, execute bounded batches
using an explicitly approved, monitored worker schedule. Redis/BullMQ
automatic scheduling is **not** added here, and the command is **not
run automatically**. DB migrations must be deployed before the command.
Database access must be restricted to trusted operations personnel.

The registration route is not wired in this staging PR. Before launch,
complete TTL/anti-replay policy review with security, approve a monitored
worker cadence and cleanup alarms, review schema/client compatibility,
ensure #75 delivers the encrypted message, and #77 issues the canonical
first session.

## Authentication challenges

Email verification, password reset, invitation, and MFA use purpose-bound
challenges. A challenge contains or resolves:

```text
challengeId
userId
purpose
codeHmac
attemptCount
maximumAttempts
expiresAt
deliveryTargetHash
```

Rules:

- Generate numeric codes with cryptographically secure randomness.
- Compute the stored verifier with a server-side pepper and challenge context.
- Scope verification by challenge ID, user, and purpose.
- Increment attempts and consume a successful challenge atomically.
- Expire challenges after a short period.
- Invalidate an older challenge when a replacement is issued.
- Rate-limit by IP, normalized identity, challenge, and delivery destination.
- Return generic responses for unknown accounts.

Raw codes and reset tokens must not enter PostgreSQL, logs, outbox events, failed
jobs, or analytics.

## Session model

- Access tokens are short-lived signed JWTs containing identity, session ID, and
  token metadata only.
- Authorization roles and full permission lists are not trusted from access
  tokens.
- Refresh tokens are opaque random values. Only hashes are stored.
- Every refresh rotates the token and links it to a token family.
- Reuse of a replaced refresh token revokes the whole family.
- Sessions record device-safe metadata, creation, activity, expiry, and
  revocation.
- Password reset revokes all existing sessions.
- MFA or privilege changes require step-up authentication and may revoke other
  sessions.

Browser refresh tokens use secure, HTTP-only cookies with an explicit CSRF
control. Mobile refresh tokens use operating-system secure storage.

## MFA

- TOTP factors are confirmed before activation.
- TOTP secrets are envelope-encrypted at rest.
- Recovery codes use cryptographically secure randomness and are stored as
  individual hashes.
- Recovery codes are single-use.
- Organization owners, organization administrators, and platform operators must
  enroll in MFA.
- Regenerating recovery codes requires recent password and MFA verification.
- Sensitive operations may require a recent step-up challenge even when the
  session is otherwise valid.

## Organization authorization

The active organization is session context, not user identity. Changing it
requires an active membership. Every request then resolves the membership and
permissions for `(userId, organizationId)` and fails closed when membership is
missing, suspended, or removed.

Cache keys always include both identifiers. Membership and permission changes
invalidate their cache entries immediately.

## Prohibited patterns

- Accepting a role or permission in public registration.
- Updating a role through a profile endpoint.
- Encoding frontend redirect paths in the backend identity model.
- Issuing a session before verification is complete.
- Long-lived access JWTs used as refresh tokens.
- Plaintext MFA secrets or recovery codes.
- Raw OTP or reset values in durable stores or queue payloads.
- Trusting an organization ID without membership resolution.
