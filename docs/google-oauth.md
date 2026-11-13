# Canonical Google OAuth

Issue #79 replaces the legacy email-matching Google login with a nonce-bound,
one-time transaction flow. Google identities resolve only through the durable
`(issuer, subject)` key in `external_identities`; a verified email is never an
account-linking key.

## Configuration

`GOOGLE_WEB_CLIENT_IDS` and `GOOGLE_MOBILE_CLIENT_IDS` are comma-separated
allowlists of Google OAuth client IDs. A client supplies the exact audience it
will use when starting a transaction. The API rejects an audience outside the
allowlist and binds the accepted value to the transaction. `GOOGLE_CLIENT_ID`
is a temporary fallback for the web allowlist while clients migrate.
Set `GOOGLE_OAUTH_ENABLED=true` when at least one client-ID allowlist is
configured. Without client IDs OAuth is explicitly disabled and returns
`OAUTH_DISABLED`; enabling it without an allowlist fails application startup.

ID-token verification uses Google's public signing keys through
`google-auth-library`. The backend does not require or accept a Google client
secret because this contract verifies client-obtained OpenID Connect ID tokens;
it does not exchange authorization codes.

## Flow

1. Start `POST /api/auth/oauth/google/transactions` with `signup` or `signin`,
   consumer, and exact audience. Signup also binds patient or healthcare-
   professional intent and the current legal versions.
2. Use the returned nonce in the Google request. The transaction token and nonce
   are returned once; PostgreSQL stores only SHA-256 hashes.
3. Complete `POST /api/auth/oauth/google/complete` with the transaction handle,
   transaction token, and Google ID token.
4. The backend verifies signature, issuer, audience, authorized party, expiry,
   issued-at (through the official library), nonce, subject, and verified email.
5. Completion locks and consumes the transaction. Replay and concurrent
   completion fail closed.

Linking starts at the authenticated
`POST /api/auth/oauth/google/link/transactions` endpoint and requires a session
created within the preceding ten minutes. Unlinking uses
`DELETE /api/auth/oauth/google/link`, also requires recent authentication, and
cannot remove the last usable authenticator. Completion rechecks the bound
session, account state, and canonical email. Unlinking revokes all sessions in
the identity transaction and writes a pointer-only security notification to
the outbox. Run `npm run oauth-security-notifications:dispatch` regularly in
development or `npm run oauth-security-notifications:dispatch:prod` in the
deployed worker/container to
send the notification to the verified canonical contact. Delivery is retried
up to five times; a terminal failure remains in the outbox for operations.

## Signup and contact verification

Google signup supports only `patient` and `healthcare_professional`. Organization
intents return `OAUTH_INTENT_NOT_SUPPORTED`. Gmail and verified Google Workspace
identities provide authoritative contact verification. Other Google-verified
third-party addresses create the canonical pending account, identity, persona,
and legal records but receive the normal OHealth contact-verification
continuation and no session.

OAuth-only accounts have `password_authentication_enabled = false`. Password
login checks this explicit state even if a generated placeholder hash exists.
Existing accounts without a legacy Google ID retain password authentication.
Google-linked accounts with a versioned OHealth password hash retain it too.
Legacy Google-linked bcrypt hashes cannot distinguish a genuine password from
the generated placeholder; these ambiguous accounts are conservatively marked
password-disabled and may use verified password recovery to establish a new
usable password. This prevents an unknowable placeholder from satisfying the
last-authenticator rule.

## Privacy, retention, and auditing

Google ID tokens, transaction tokens, raw nonces, email addresses, and provider
profile payloads are absent from transaction records, audit metadata, and logs.
OAuth transactions contain hashes and bounded routing metadata, expire after
five minutes, and may be deleted after 24 hours. External identities remain for
the life of the user identity or until explicit unlinking; deleting the user
cascades them. Security events record allowlisted signup, sign-in, link, unlink,
conflict, and denial outcomes with internal UUIDs only.

The legacy `POST /api/auth/google-login` endpoint is fail-closed and returns
HTTP 410 with `OAUTH_TRANSACTION_REQUIRED`; it cannot create, sign in, or link
an account.
