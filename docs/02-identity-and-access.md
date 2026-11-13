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

Public registration accepts exactly one initial intent from this closed list:

- `patient`
- `healthcare_professional`
- `pharmacy`
- `laboratory`
- `hospital`

The intent creates onboarding state, not a client-selected authorization role.
The intent itself determines the persona or organization type; public clients do
not submit a separate role, permission, or organization type.

| Intent                    | User-facing label       | Canonical mapping                                                         | Initial onboarding state                                                                                                                                |
| ------------------------- | ----------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `patient`                 | Patient                 | Active patient persona and patient-profile ownership                      | Account remains pending until email verification; no session is issued before verification.                                                             |
| `healthcare_professional` | Healthcare Professional | Active healthcare-professional persona                                    | Account remains pending until email verification; professional profile setup and professional verification remain required.                             |
| `pharmacy`                | Pharmacy                | Pharmacy organization plus `owner` membership for the registering human   | Account remains pending until email verification; organization verification starts `pending` and operational access remains unavailable until approval. |
| `laboratory`              | Laboratory              | Laboratory organization plus `owner` membership for the registering human | Account remains pending until email verification; organization verification starts `pending` and operational access remains unavailable until approval. |
| `hospital`                | Hospital                | Hospital organization plus `owner` membership for the registering human   | Account remains pending until email verification; organization verification starts `pending` and operational access remains unavailable until approval. |

Hospital self-service registration is included in the current Accounts and
Sign-In scope. This decision expands the older MVP flow that deferred full
hospital integration; it does not grant operational hospital access before
organization review and approval. Laboratory and hospital remain distinct
organization types with distinct verification and onboarding state.

The canonical Accounts and Sign-In selector labels are Patient, Healthcare
Professional, Pharmacy, Laboratory, and Hospital. The Figma selector must expose
the same five choices. Older product copy that says “Doctor” for this selector
maps to Healthcare Professional and does not create a separate signup intent.

## Registration flow

1. Normalize the email and validate the password and legal-document versions.
2. Create the user in `pending_verification` state.
3. Create the requested persona, or the organization and owner membership.
4. Record terms and privacy-policy acceptance.
5. Create an authentication challenge and encrypted durable delivery record.
6. Commit all durable records atomically.
7. Deliver the verification message asynchronously through the challenge
   delivery worker.
8. Return the challenge identifier, masked destination, expiry, and resend wait.

Registration does not return an ordinary access or refresh token.

## Authentication challenges

Email verification, password reset, invitation, and MFA use purpose-bound
challenges. A challenge contains or resolves:

```text
challengeId
userId
purpose
lineageId
replacementChallengeId
codeHmac
attemptCount
maximumAttempts
expiresAt
flowExpiresAt
deliveryTargetHash
```

Rules:

- Generate numeric codes with cryptographically secure randomness.
- Compute the stored verifier with a server-side pepper and challenge context.
- Scope verification by challenge ID, user, and purpose.
- Increment attempts and consume a successful challenge atomically.
- Expire challenges after a short period.
- Invalidate an older challenge when a replacement is issued.
- Return the authoritative replacement when an old handle is retried after a
  lost response; concurrent resends create at most one replacement.
- Record successful use, supersession, attempt exhaustion, and administrative
  revocation as distinct terminal reasons.
- Rate-limit by IP, normalized identity, challenge, and delivery destination.
- Return generic responses for unknown accounts.

Public resend is challenge-bound and purpose-bound by its route. Initial
email-based recovery remains generic and returns no handle. Stable error codes,
retry metadata, and the trusted recovery-link contract are documented in
`auth-challenge-continuation.md`.

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

## External identities and Google OAuth

External providers are authenticators attached to the organization-neutral
`User`. Provider identity is resolved by the immutable issuer and subject pair,
never by email. Google signup, sign-in, and linking use short-lived one-time
backend transactions that bind operation, consumer, audience, nonce, signup
intent, and legal versions. See `google-oauth.md` for the executable contract,
privacy rules, and rollout configuration.

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
