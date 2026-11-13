# Canonical refresh sessions

OHealth issues short-lived HS256 access JWTs bound to a server-controlled
session ID. Refresh credentials are 32 random bytes encoded as base64url. Only
their SHA-256 digests are stored.

Every successful refresh consumes the presented credential and creates a new
credential in the same database transaction. The session ID and absolute
expiry remain stable. Reuse of any consumed credential revokes that session
family. Access-token validation reads the current user and session state, so
logout, password reset, password change, suspension and deactivation take
effect without waiting for the access JWT to expire.

Legacy JWT refresh sessions are revoked by the additive migration because they
cannot provide rotation history or replay detection. Rolling the migration back
does not reactivate those sessions.

The API exposes only the session ID and creation, last-use and expiry timestamps.
It does not claim device identity until the service has a trustworthy device
registration source. Mobile clients receive the opaque refresh credential in
the existing JSON response and keep it in operating-system secure storage.

Browser clients use the backend-managed cookie adapter under `/auth/browser`.
JavaScript receives the short-lived access token and safe session context, but
never the refresh credential. Production and staging use a host-only
`__Host-ohealth_refresh` cookie with `Secure`, `HttpOnly`, `SameSite=Strict`,
`Path=/`, no `Domain`, and `Max-Age` bounded by the remaining absolute session
lifetime. Local development uses the separately named `ohealth_refresh_dev`
cookie; that fallback cannot be selected in staging or production.

Browser verification, login verification, refresh, and logout remain thin
presentation adapters over the same challenge and `RefreshSessionService`
boundaries used by mobile. Refresh rotates the canonical credential. Logout
revokes the server-side session before clearing the cookie. Invalid, expired,
revoked, or replayed credentials return `401` and clear the cookie using the
same custody attributes. The browser endpoints never accept the credential in
JSON, query parameters, an authorization header, or an alternate cookie; mobile
refresh never reads the browser cookie.

Cookie-authenticated requests require an exact configured `Origin` and
`X-OHealth-Client: browser`. Request bodies, when present, must be JSON. Missing,
`null`, wildcard, reflected, regex-wide, and unapproved origins fail closed.
When browser sessions are enabled, staging and production startup require at
least one exact HTTPS `CORS_ORIGINS` entry. Browser applications and the API are
assumed to remain under the approved same registrable HTTPS site; changing that
topology requires a separate `SameSite` security review.

Browser Google completion remains absent while issue #79 finalizes OAuth. After
#79 merges, its transport-neutral session result must be connected to this
cookie adapter without changing the mobile credential response.

Consumed credential history is retained through the session's absolute expiry
so replay remains detectable. Expired version-2 sessions may be removed after
the maximum 15-minute access-token lifetime has elapsed. Security audit records
follow their separate retention policy.
