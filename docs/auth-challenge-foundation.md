# Issue #75 — secure challenge foundation (incremental)

This change implements reusable challenge and abuse-control storage. It does **not** complete #75 or switch public auth routes to the new implementation.

## Security and data model

- Additive `auth_challenges` migration: UUID challenge identity, purpose allowlist (contact verification or password recovery), subject UUID, HMAC-SHA-256 digest of the six-digit code, issue time, expiry, failed-attempt counter and consumed timestamp. Raw codes and emails are never stored in this table.
- Every HMAC uses the challenge UUID and purpose as domain separation. Set `AUTH_CHALLENGE_PEPPER` from an independently generated high-entropy secret (at least 32 random bytes) in the deployment secret manager **before wiring any producers**. No production fallback. Coordinate key rotation to avoid invalidating outstanding challenges unexpectedly.
- `issueInTransaction` locks the subject user row across processes; enforces a 60-second issuance cooldown; consumes earlier unconsumed challenges of the same purpose; inserts a fresh code that expires after 10 minutes. A partial unique index enforces at most one usable challenge per user per purpose.
- `consumeWithMutation` enforces purpose and expiry, increments failed attempts up to five, and consumes a successful challenge with the caller-supplied account mutation in one database transaction. Callback failures roll back consumption; invalid guesses are committed before returning a generic error.
- `auth_rate_limit_buckets` uses atomic PostgreSQL upsert counters shared by all instances. Only HMAC-SHA-256 fingerprints of scope and key are stored, never raw IPs or addresses. Database errors fail closed.

## What remains to finish issue #75

1. Wire the live signup, verification, resend, password-reset request and completion flows to challenge issuance/consumption. Change public DTO/OpenAPI clients to identify the challenge by UUID; never return a secret in an HTTP response.
2. Reuse #76's central password policy for secure challenge-based reset completion, #74's canonical account transitions, and #81's audit events in the same transaction. Baseline legacy session revocation is already transactional in #75. **#75 blocks #77; #77 does not block #75.** Issue #77 subsequently adds refresh rotation and replay detection.
3. Provide durable delivery with an approved encrypted-outbox/worker design, email retry and idempotency. **Never write plaintext codes into outbox JSON.** Do not return “sent” unless the provider actually accepted the message; distinguish queued from sent where applicable.
4. Validate the now-connected PostgreSQL subject/IP rate-limit guard on login, verification, resend, recovery request and reset completion against real HTTP and shared DB instances. The guard uses the socket peer and ignores spoofable forwarding headers; behind a reverse proxy this can group many legitimate users under one IP. Validate the ingress topology before deploying, then configure trusted proxy resolution and test spoofing safely.
5. Add end-to-end HTTP, concurrency, brute-force, challenge-ID collision and provider-failure tests; migrate off legacy plaintext user-level verification and reset columns, using a staged rollout that allows old codes to expire before removal.
6. Rehearse the migration and pepper setup in staging before deployment. Review retention and disposal policy for expired challenges and rate-limit buckets.

## Important deployment constraint

This PR adds a database migration, injectable security services, guarded public authentication routes, and baseline atomic password-reset session revocation. **Legacy plaintext verification/recovery producers still run**, so do not treat this as the final remediation. Deploying the guards requires the migration and the securely configured `AUTH_CHALLENGE_PEPPER`; do not merge before that rollout is planned.

Keep issue #75 **OPEN** and keep this PR **DRAFT** until all added code and CI are checked.

## 27 October: encrypted delivery handoff (staged, not live)

- Added an additive `auth_challenge_deliveries` PostgreSQL table and an internal `AuthChallengeDeliveryService.queueInTransaction(manager, user, purpose)`. It creates the purpose-bound challenge and AES-256-GCM encrypted six-digit recovery envelope in the **same caller-owned transaction**, ready for #78's pending-registration writer to consume after review.
- `AUTH_CHALLENGE_DELIVERY_KEY` must be a separately generated **base64-encoded 32-byte key** from the secret manager. There is no fallback. Store and rotate it separately from `AUTH_CHALLENGE_PEPPER`; rotating prematurely makes pending delivery envelopes undecryptable.
- An internal bounded batch worker uses `FOR UPDATE SKIP LOCKED`, checks expiry/consumption, calls the existing email provider, and clears IV/ciphertext/tag on acceptance or final discard. Transient failures have at most five attempts with backoff. It reports **provider acceptance**, not final inbox delivery. The transport is **at-least-once**: an email accepted before a database outage can be repeated.
- Trusted-operator invocation, after migration and secret setup: `npm run auth-challenge-delivery:dispatch -- --batch-size=5` (maximum 10). No HTTP route or scheduler has been introduced. Deployment operators must approve and arrange an appropriate cadence, monitoring, queue age thresholds, and cleanup of delivery metadata. The CLI prints aggregate counts only; exceptions are redacted.
- The internal envelope holds no raw password, code, email address, or provider token. The email recipient is loaded from the canonical user record at dispatch time. A consumed/expired challenge is discarded instead of sent.
- **Critical: Public signup/verify/resend/forgot/reset remain on the legacy code path for now.** An approved API/client rollout must switch every producer and consumer atomically, deprecate the plaintext columns safely, and connect #78/#77. Do not present this staged infrastructure or its CI as completed Issue #75.
