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
