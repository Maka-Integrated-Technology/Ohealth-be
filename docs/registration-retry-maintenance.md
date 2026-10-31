# Registration retry receipt maintenance (issue #78)

**Scope:** Internal, operator-triggered maintenance for the pending-registration idempotency journal. This is not a signup endpoint, an email/challenge cleanup job, or a replacement for issue #75 verification/recovery.

## Retention and safety

- Keep a retry receipt until at least **24 hours after the original challenge expiry**, then permit deletion. The cleanup predicate uses the database clock (`challenge_expires_at < now() - interval '24 hours'`).
- Delete **only** rows from `registration_attempts`. Do not remove accounts, profiles, legal acceptance, authentication challenges, delivery envelopes, or outbox events.
- Each transaction deletes at most **500** eligible receipts, ordered by expiry and HMAC key. `FOR UPDATE SKIP LOCKED` avoids waiting for a concurrently locked retry row.
- Once a receipt is removed, repeating its old idempotency key must **not** create a second account: existing normalized-email uniqueness produces HTTP 409. The client should use the approved verification resend/recovery flow, not interpret an old key as a fresh signup.
- Use the server-secret HMAC pepper to derive retry keys and request fingerprints. Never emit key hashes, fingerprints, user identities, plaintext passwords, database exception strings, or verification secrets in maintenance telemetry.

## Deployment and operation

1. Apply and verify the additive registration idempotency and expiry-index migrations before enabling the registration retry functionality.
2. Configure `REGISTRATION_IDEMPOTENCY_PEPPER` as a managed secret of at least 32 random bytes for the registration service. Plan secret rotation deliberately: rotation invalidates lookup of existing retry receipts until they expire.
3. From a trusted worker or administrative environment configured for the target PostgreSQL database, run one bounded batch:

   ```bash
   npm run registration-retries:prune -- --batch-size=200
   ```

4. The command prints only the number of expired retry receipts removed. Re-run bounded batches when appropriate; do not assume a single invocation removes a large backlog. Do not expose the command over HTTP or schedule it until an operations owner has approved cadence, database load expectations, and monitoring.
5. Confirm the PostgreSQL integration tests and CLI validation check pass after changes. If a command fails, inspect authorized database/operational diagnostics rather than printing raw exception details to public logs.

## Limitations and dependencies

- A **24-hour** grace period is the current retention rule, not a guarantee that a receipt remains usable: registration retries return 409 as soon as the original challenge expires or the account is no longer pending.
- The #78 integration with the merged #75 delivery service must define what to do when a still-unexpired challenge is consumed, invalidated, or superseded by resend. Do **not** connect the public signup route until this has a security-reviewed behavior.
- Public idempotency-key transport, registration-to-delivery adapter integration, end-to-end compatibility, and issue #77 canonical session issuance remain gated. The recovery replacement for closed PR #100 must stay **draft** until these dependencies are complete.
