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
- Authenticated password change verifies the current credential under the user
  row lock, rejects reuse of the current password, and terminates every session,
  including the caller's. The client must sign in again. The same transaction
  invalidates pending login, MFA login, and password-recovery challenges and
  records the password-change security event.
- MFA or privilege changes require step-up authentication and may revoke other
  sessions.

Browser refresh credentials use the backend-managed `/auth/browser` adapter and
never enter browser-readable response JSON or storage. Production and staging
use a host-only `__Host-ohealth_refresh` cookie with `Secure`, `HttpOnly`,
`SameSite=Strict`, `Path=/`, no `Domain`, and lifetime bounded by the canonical
session expiry. Browser refresh and logout require an exact allowlisted Origin
and `X-OHealth-Client: browser`; browser request bodies are JSON-only. Local
development uses a separately named cookie and cannot weaken deployed policy.
Mobile retains the JSON credential contract for operating-system secure
storage. Both transports use the same rotation, replay-family revocation,
account policy, and audit authority. Google transactions bind their consumer:
mobile completes through `/auth/oauth/google/complete` and retains the approved
body credential, while web completes through
`/auth/browser/oauth/google/complete` and receives refresh state only in the
backend-managed cookie.

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

The live lifecycle uses POST /auth/2fa/enable, /confirm,
/recovery-codes/regenerate, and /disable. Enrollment and factor changes require
the current password; replacing, regenerating, and disabling an active factor
also require a fresh TOTP proof. Confirmation and factor-state changes revoke
existing sessions.

Password or Google sign-in first completes its existing proof. When an active
factor exists, the response contains an opaque mfa_challenge_id instead of a
session. POST /auth/login/mfa/verify, or its browser-cookie equivalent, accepts
a TOTP or one-time recovery code and is the only continuation that may issue
the session. The challenge is purpose-bound, expires, permits five attempts,
and is atomically consumed with the factor proof and session.
OAuth-created MFA continuations also retain the transaction's web or mobile
consumer binding, so a browser flow cannot be exchanged through the mobile
JSON credential boundary or vice versa. Password-login continuations remain
transport-neutral because the caller selects its presentation boundary after
the shared password and contact proofs.

MFA_ENCRYPTION_KEY is a managed 32-byte base64 key-encryption key. Each TOTP
secret uses a fresh data key and authenticated AES-GCM envelope. Recovery codes
are returned only when created, stored as individual SHA-256 hashes, and
deleted atomically when used. The secure-MFA migration disables legacy factors
and removes their plaintext secret and backup-code columns, requiring
re-enrollment.

Privileged capability enforcement reads current platform privileges and active
organization memberships. MFA_REQUIRED_CATEGORIES configures whether
platform_admin, organization_owner, and organization_admin capabilities require
an active factor. Users retain basic account access while enrolling, but
configured privileged capabilities fail closed until enrollment completes.
Enrollment start, activation, recovery-code regeneration, and disablement use
distinct durable security-audit event types. MFA login proof successes and
denials remain under the general `mfa` verification event.

## Organization authorization

The active organization is session or explicit request context, not user
identity. Clients select it with `X-Organization-Id` on organization-scoped
routes. Every request resolves the exact active membership and permissions for
`(userId, organizationId)` and fails closed when the selector is missing or the
membership is missing, suspended, or removed. A capability obtained from one
membership can never authorize a resource belonging to another organization.

Cache keys always include both identifiers. Membership and permission changes
invalidate their cache entries immediately.

## Canonical account context and capability matrix

Authenticated login verification, signup verification, Google OAuth completion,
refresh, and `GET /auth/me` return the same server-resolved account context.
The context contains account lifecycle state, active personas, professional
onboarding and verification state, organization memberships, session-safe
metadata, and derived capabilities. It never contains frontend route names or
client-writable authorization state.

The initial capability boundary is:

| Subject and state                                                     | Allowed capabilities                                                                                           | Denied capabilities                                                           |
| --------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Active patient persona                                                | patient bookings and professional reviews                                                                      | professional care, organization administration, platform review               |
| Active healthcare-professional persona, pending/rejected verification | profile onboarding and verification documents/status                                                           | dashboard, availability operations, booking operations, patient records/notes |
| Active approved healthcare professional                               | professional onboarding, verification, dashboard, availability, booking operations, patient-care resources     | unrelated organization administration and platform review                     |
| Active organization owner/admin, organization pending                 | organization onboarding, documents, status and submission                                                      | approved operational resources                                                |
| Active organization owner/admin, organization approved                | organization onboarding and approved operational resources                                                     | resources in other organizations                                              |
| Active organization member                                            | `organization.member`; `organization.operational` only when approved and explicitly granted by that membership | owner/admin, platform, persona, and unrelated organization resources          |
| Platform administrator                                                | explicitly assigned platform review capabilities                                                               | organization resources without an independent membership                      |

Personas are not roles. Organization access is resolved from the membership for
the requested organization, and platform privileges are stored separately from
the legacy user role array. Protected requests re-read current account and
session state; a JWT never authorizes from embedded roles or permissions.
The only supported membership override is `organization.operational`; it takes
effect only after approval. Unknown, platform, persona, and administrative
override strings never grant capabilities.

## Prohibited patterns

- Accepting a role or permission in public registration.
- Updating a role through a profile endpoint.
- Encoding frontend redirect paths in the backend identity model.
- Issuing a session before verification is complete.
- Long-lived access JWTs used as refresh tokens.
- Plaintext MFA secrets or recovery codes.
- Raw OTP or reset values in durable stores or queue payloads.
- Trusting an organization ID without membership resolution.
