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
registration source. Browser clients must not place refresh credentials in
local storage. A browser rollout requires a secure HTTP-only cookie or BFF and
explicit CSRF protection; mobile clients use operating-system secure storage.

Consumed credential history is retained through the session's absolute expiry
so replay remains detectable. Expired version-2 sessions may be removed after
the maximum 15-minute access-token lifetime has elapsed. Security audit records
follow their separate retention policy.
