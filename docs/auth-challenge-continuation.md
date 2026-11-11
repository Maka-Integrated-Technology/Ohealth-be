# Authentication challenge continuation

Status: implemented for contact verification, login verification, and password
recovery.

## Public contract

Challenge creation and safe replacement return one continuation shape:

```json
{
  "status_code": 200,
  "message": "Verification code queued",
  "data": {
    "challenge_id": "opaque-uuid",
    "resend_after_seconds": 60,
    "expires_in_seconds": 600
  }
}
```

Signup may additionally return a masked delivery target under `data`. The
client stores the opaque handle only for the current flow. It never supplies a
purpose; the route selects contact verification, login verification, or
password recovery.

Resend routes are challenge-bound:

- `POST /auth/verify/resend`
- `POST /auth/login/resend`
- `POST /auth/forgot-password/resend`

Each accepts only `challenge_id`. A successful replacement invalidates the old
code. Repeating the request with the previous handle returns the authoritative
replacement, so a lost HTTP response does not strand the client. Cooldown and
lineage send limits return `429` rather than a successful no-op. A lineage
allows at most five replacements and remains live for at most 30 minutes.

The email-based `POST /auth/forgot-password` entry point returns generic
`202 Accepted` content for eligible, ineligible, and unknown accounts. It never
returns a challenge handle. Eligible users receive the handle through email.

## Recovery link

`AUTH_RECOVERY_CONTINUATION_URL` is a trusted HTTPS URL without credentials,
query, or fragment, for example:

```text
https://app.ohealth.example/reset-password
```

The worker appends only `challenge_id`. It never derives the origin from an HTTP
request and never puts a code in the URL. Web reset surfaces must send
`Referrer-Policy: no-referrer`; mobile Universal Link/App Link association and
routing remain client/deployment responsibilities.

## Machine-readable failures

Challenge failures retain the standard error envelope and add `error_code`.
Retryable `429` and `503` responses also contain `retry_after_seconds` and the
same integer in the `Retry-After` header. Clients branch on `error_code`, never
English text.

The catalogue is `AUTH_CHALLENGE_INVALID`, `AUTH_CHALLENGE_CODE_INVALID`,
`AUTH_CHALLENGE_EXPIRED`, `AUTH_CHALLENGE_CONSUMED`,
`AUTH_CHALLENGE_SUPERSEDED`, `AUTH_CHALLENGE_ATTEMPTS_EXHAUSTED`,
`AUTH_CHALLENGE_COOLDOWN`, `AUTH_CHALLENGE_DELIVERY_UNAVAILABLE`,
`AUTH_SERVICE_TEMPORARILY_UNAVAILABLE`, and `AUTH_RATE_LIMITED`.

Malformed, unknown, and wrong-purpose handles collapse to
`AUTH_CHALLENGE_INVALID`. A valid opaque handle may safely reveal its terminal
state. Persistence records lineage, replacement, replacement count, flow
lifetime, and terminal reason. Raw codes remain HMAC-only in challenge storage
and encrypted only in the short-lived delivery envelope.

## Rollout order

The resend request change from `email` to `challenge_id` is breaking. Production
promotion remains blocked until migration issues or pull requests are linked for
mobile, dashboard, and patient web, and an authorized maintainer applies the
`api-breaking-change-approved` label.

1. Each consumer first ships dual-contract support: retain the legacy email
   request when no continuation handle was returned, and prefer `challenge_id`
   when the response supplies one.
2. Mobile adoption or a minimum-supported-version gate must make legacy-only
   installed clients safe to retire before the backend removes email resend.
3. Deploy this backend contract to staging, activate the consumer continuation
   path there, and verify signup, login, resend, and recovery end to end.
4. Promote the backend only after all three consumer migrations and staging
   evidence are linked. Consumer support must be live before the production
   backend stops accepting the legacy request.
