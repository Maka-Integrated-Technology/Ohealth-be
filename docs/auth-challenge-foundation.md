# Issue #75 — purpose-bound authentication and durable challenge delivery

Public signup, verification, resend, password recovery, laboratory onboarding, and organization onboarding now use the transactional challenge writer/consumer. **Do not deploy or merge before the breaking OpenAPI/client rollout is approved, the encryption key and worker are configured, and security sign-off is recorded.**

## Security and data model

- Additive `auth_challenges` migration: UUID challenge identity, purpose allowlist (contact verification or password recovery), subject UUID, HMAC-SHA-256 digest of the six-digit code, issue time, expiry, failed-attempt counter and consumed timestamp. Raw codes and emails are never stored in this table.
- Every HMAC uses the challenge UUID and purpose as domain separation. Set `AUTH_CHALLENGE_PEPPER` from an independently generated high-entropy secret (at least 32 random bytes) in the deployment secret manager **before wiring any producers**. No production fallback. Coordinate key rotation to avoid invalidating outstanding challenges unexpectedly.
- `issueInTransaction` locks the subject user row across processes; enforces a 60-second issuance cooldown; consumes earlier unconsumed challenges of the same purpose; inserts a fresh code that expires after 10 minutes. A partial unique index enforces at most one usable challenge per user per purpose.
- `consumeWithMutation` enforces purpose and expiry, increments failed attempts up to five, and consumes a successful challenge with the caller-supplied account mutation in one database transaction. Callback failures roll back consumption; invalid guesses are committed before returning a generic error.
- `auth_rate_limit_buckets` uses atomic PostgreSQL upsert counters shared by all instances. Only HMAC-SHA-256 fingerprints of scope and key are stored, never raw IPs or addresses. Database errors fail closed.

## Code implemented and merge/deployment conditions

- Public `signup` stores a pending user, a purpose-bound challenge and an encrypted delivery receipt atomically. The HTTP response includes an opaque `challenge_id` and states *queued*, never *sent*. It does not grant a session.
- `verify` consumes a six-digit code with the supplied `challenge_id`, activates the account, and records the account-status transition and audit event in the same transaction. Session issuance remains on the current baseline until #77 integrates rotating sessions.
- `verify/resend` and `forgot-password` return a generic response for unknown or ineligible accounts, subject to the shared PostgreSQL rate limiter and issuance cooldown. They do not expose raw codes or reset tokens.
- `reset-password` accepts `challenge_id`, `code` and a policy-compliant replacement password, consumes a password-recovery challenge, changes the password, revokes active sessions and audits in one transaction. Suspended and deactivated accounts are rejected at consumption time.
- Lab/organization administrator onboarding queues encrypted verification within its existing transaction. Both email templates show challenge IDs. Verification email links contain only an opaque ID, **not the six-digit code**.
- A regression suite checks public HTTP DTOs, login and account-state policies, challenge replay/expiry/cooldown/attempt bounds, basic PostgreSQL delivery integration and provider failures.

### Required approvals and rollout sequence

1. **Human approval of breaking API contracts.** The previous `verify` email/code and `reset-password` legacy token shapes are deliberately unsupported. Regenerate and integrate all frontend/mobile consumers using `contracts/openapi.json` and `packages/api-client`; coordinate client rollout before enabling the backend. The GitHub Actions `api-breaking-change-approved` label is an explicit reviewer gate and must not be applied merely to silence CI.
2. **Staging infrastructure:** apply additive migrations; configure independent high-entropy `AUTH_CHALLENGE_PEPPER` and base64 `AUTH_CHALLENGE_DELIVERY_KEY`; verify actual mail provider/credentials and a trusted worker schedule for the bounded dispatch command. Monitor queue age, provider acceptance, retries, discards and service health without logging recipients, codes, or plaintext secrets.
3. **Safe legacy deprecation:** during the coordinated deployment, allow preexisting user-level verification/reset codes to expire (10-minute previous TTL), invalidate any remaining pending codes, and have clients request new challenges. The new public endpoints never read or write old code columns; leave nullable columns temporarily for additive compatibility, remove them in a separately approved migration once old instances and writes have drained. Never re-enable a plaintext fallback.
4. **Security and QA:** review cross-instance rate limits and reverse-proxy IP handling; rehearse challenge issuance/consumption and delivery on staging PostgreSQL; test concurrency, failure recovery, provider acceptance and at-least-once duplicate delivery. Confirm that migrations, secrets, cleanup cadence, and audit telemetry are operational. Obtain required verified commit signatures and senior approval.
5. **Dependency sequence:** #75 precedes #77. Once #75 lands, finalize #77's canonical sessions in PR #88, then rebase the #78/#79/#80/#90 stacked PRs in order. Do not merge the temporary validation PR #109.

Keep this PR **DRAFT** until these gates pass. A green unit/integration suite alone does not constitute authorization to merge.

## 27 October: encrypted delivery handoff

- Added an additive `auth_challenge_deliveries` PostgreSQL table and an internal `AuthChallengeDeliveryService.queueInTransaction(manager, user, purpose)`. It creates the purpose-bound challenge and AES-256-GCM encrypted six-digit recovery envelope in the **same caller-owned transaction**, ready for #78's pending-registration writer to consume after review.
- `AUTH_CHALLENGE_DELIVERY_KEY` must be a separately generated **base64-encoded 32-byte key** from the secret manager. There is no fallback. Store and rotate it separately from `AUTH_CHALLENGE_PEPPER`; rotating prematurely makes pending delivery envelopes undecryptable.
- An internal bounded batch worker uses `FOR UPDATE SKIP LOCKED`, checks expiry/consumption, calls the existing email provider, and clears IV/ciphertext/tag on acceptance or final discard. Transient failures have at most five attempts with backoff. It reports **provider acceptance**, not final inbox delivery. The transport is **at-least-once**: an email accepted before a database outage can be repeated.
- Trusted-operator invocation, after migration and secret setup: `npm run auth-challenge-delivery:dispatch -- --batch-size=5` (maximum 10). No HTTP route or scheduler has been introduced. Deployment operators must approve and arrange an appropriate cadence, monitoring, queue age thresholds, and cleanup of delivery metadata. The CLI prints aggregate counts only; exceptions are redacted.
- The internal envelope holds no raw password, code, email address, or provider token. The email recipient is loaded from the canonical user record at dispatch time. A consumed/expired challenge is discarded instead of sent.
- Public endpoints now use this new service. The remaining blockers are client coordination, approved staging/worker rollout, additional security review, and verified signatures. Do not claim final release readiness until those gates pass.
