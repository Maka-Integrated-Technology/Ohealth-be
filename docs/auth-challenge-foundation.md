# Issue #75 — secure challenge and delivery foundation

PR #111 (PR A) supplies reusable PostgreSQL challenge, abuse-control and encrypted
email delivery services. PR #99 (PR B) migrates the live routes and public
DTO/OpenAPI clients. The foundation can deploy dormant before PR B. Both PRs
remain Ready for review; issue #75 stays open until the full acceptance matrix
and independent security/deployment review are complete.

## Security and persistence

- `auth_challenges` stores a UUID, allowlisted purpose, subject UUID, HMAC-SHA-256
  verifier, timestamps, failed-attempt count and consumed timestamp. It never
  stores the raw code or recipient address. The HMAC binds the UUID and purpose.
- Issuance locks the subject row across instances, enforces a 60-second cooldown,
  invalidates earlier challenges for that purpose and expires new codes after
  ten minutes. A partial unique index prevents multiple usable challenges.
- Consumption checks purpose, expiry and the five-attempt limit. Successful
  consumption and the protected account mutation commit atomically; mutation
  failure rolls back consumption. Invalid guesses commit their attempt count.
- `auth_rate_limit_buckets` stores atomic shared PostgreSQL counters keyed by
  HMAC fingerprints, not raw email/IP values. Database failures fail closed.
- `queueInTransaction` creates the challenge and AES-256-GCM encrypted recovery
  envelope in the caller's transaction. Envelopes contain recoverable encrypted
  codes, never plaintext passwords/codes or recipient addresses. Recipient data
  is read from the canonical user record at dispatch. Do not copy envelopes or
  credentials into general outbox JSON, logs or analytics.

## Implemented worker runtime

This implementation uses a dedicated PostgreSQL-backed worker, not Redis or
BullMQ. The long-term queue architecture remains in `04-queues-and-redis.md`.
The worker has no public HTTP endpoint and runs independently of the API.

Build and verify the image from the repository root:

```sh
docker build -f deploy/auth-challenge-worker/Dockerfile -t ohealth-auth-worker:review .
docker run --rm --entrypoint node ohealth-auth-worker:review scripts/maintenance/check-worker-templates.cjs
```

The image installs the lockfile with `npm ci --ignore-scripts`, runs `npm run
build` to package `dist/templates`, and runs the template smoke check as the
non-root `node` user. The Docker context excludes host `dist`, `node_modules`
and `*.tsbuildinfo` so an incremental host build cannot suppress image output.
The smoke check renders verification and recovery with the actual compiled
EmailService/Nunjucks renderer; only external SMTP transport is replaced. It
proves rendering, not successful provider or inbox delivery.

After migration and secret provisioning, start the continuous deployment:

```sh
docker compose -f deploy/auth-challenge-worker/compose.yml up -d --build
```

The image's default command is:

```sh
npm run auth-challenge-delivery:dispatch -- --continuous --batch-size=10 --interval-seconds=5
```

For an operator-run single batch, omit `--continuous` and `--interval-seconds`:

```sh
npm run auth-challenge-delivery:dispatch -- --batch-size=5
```

Batch size accepts 1–10; continuous polling accepts 1–15 seconds, with a default
of five seconds. Each batch dispatches sequentially, so its duration adds to the
poll interval. One-shot mode does not publish the continuous-worker heartbeat
and is insufficient to make live producers ready. SIGTERM/SIGINT stop the loop
after the in-flight batch and close the database connection.

## Leases, retry and delivery semantics

Each dispatch uses a short `FOR UPDATE SKIP LOCKED` claim transaction, commits a
90-second lease with a unique fencing token, sends outside the database
transaction, then conditionally finalizes with the same token. A stale worker
cannot finalize a reclaimed lease. Expired processing leases can be reclaimed
after a crash. Consumed/expired challenges and exhausted attempts are discarded.

Provider waits are bounded at 30 seconds per send. Retryable failure returns the
delivery to pending with a fixed 120-second delay, up to five attempts. A crash
on the last allowed attempt cannot cause unlimited redelivery. Acceptance and
terminal discard clear the encrypted IV/ciphertext/tag; retries retain them.

Delivery is **at least once**: provider acceptance followed by database failure
or an ambiguous timeout can result in a duplicate email. Timeout does not prove
provider cancellation. Report queued versus provider-accepted accurately;
provider acceptance does not establish inbox delivery. Never log provider errors,
recipient addresses, codes, envelope contents or tokens.

## Heartbeat, readiness and monitoring

After each successful continuous batch, the worker publishes aggregate queue
metrics to `auth_challenge_worker_heartbeat` under `id = 'delivery'`:

| Signal                             | Live readiness requirement |
| ---------------------------------- | -------------------------- |
| Last successful database heartbeat | Newer than 30 seconds      |
| Oldest pending delivery            | Less than 120 seconds old  |
| Expired processing leases          | Zero                       |

The worker logs aggregate accepted/retried/discarded/pending counts, expired
leases and oldest pending age. It emits a backlog warning when pending age is
at least 120 seconds or any processing lease has expired. Infrastructure must
collect these signals and alert; the example does not provision alert delivery.
Slow provider batches can age the heartbeat and intentionally fail readiness.

The health file defaults to `/tmp/ohealth-challenge-worker-heartbeat`; it is
updated only after a successful continuous database cycle with healthy backlog.
`AUTH_CHALLENGE_WORKER_HEALTH_FILE` can override it for custom deployments; update
the healthcheck path too. The Compose healthcheck requires file age below 30
seconds, checks every 15 seconds with a five-second timeout and two retries,
and has a 45-second startup grace period. The file is a container health signal;
API readiness uses the authoritative database heartbeat/metrics. Compose's
restart policy handles process exit; an unhealthy status alone does not restart
a container. Configure external monitoring and intervention.

## Configuration and rollout order

1. Apply the additive challenge, delivery, lease and heartbeat migrations before
   starting workers or producers. Rehearse them in staging; never enable schema
   synchronization.
2. Provision independent secrets: `AUTH_CHALLENGE_PEPPER` (at least 32 bytes of
   high-entropy secret material) and `AUTH_CHALLENGE_DELIVERY_KEY` (base64-encoded
   32-byte AES key). There are no production fallbacks. Provide `DATABASE_URL`,
   the chosen SMTP/Resend credentials, `MAIL_FROM_ADDRESS`, and `FRONTEND_URL` as
   required by the Compose example. Both API and worker must share the intended
   challenge secrets/database. The worker validates its secrets at startup.
3. Build/start the continuous worker. Confirm image rendering, actual staging
   provider delivery, fresh database heartbeat, healthy queue metrics and alerts
   before deploying live producers. Do not infer deployment from green unit tests.
4. PR A can remain dormant with `AUTH_CHALLENGE_FLOWS_ENABLED=false`. In the
   combined PR B deployment, explicitly set it to `true`: PR B refuses startup
   with the flag off and uses `assertLiveFlowReady` before account eligibility
   lookup. Enabled API startup requires healthy delivery readiness. False is not
   a supported way to run PR B's live routes without readiness checks.
5. Configure `AUTH_TRUSTED_PROXY_CIDRS` for actual ingress hops; leave it empty
   for direct clients. Untrusted peers cannot select their IP through spoofed
   forwarding headers. Test IPv4/IPv6 and the deployed proxy chain before rollout.
6. Coordinate the challenge-ID verification/reset DTOs and generated clients
   with web/mobile consumers. Keep legacy columns until old nodes and codes
   have expired or migrated. Verify account transitions, audit durability and
   password-recovery session revocation. #75 blocks #77; refresh-family rotation
   and replay detection are subsequent #77 work.

## Rollback and retention

Stop or roll back live producers first, using the coordinated pre-PR-B API/client
release if necessary. Do not merely set the flag false on PR B and expect live
routes to continue: that release must refuse startup. Keep a compatible worker
and its secrets available while valid queued challenges drain, or explicitly
invalidate affected challenges through an approved operational procedure. Then
stop the worker. Preserve additive tables during rollback; do not revert
migrations or erase audit evidence as part of a routine application rollback.

Keep the old encryption key and pepper until dependent challenges expire or
are deliberately invalidated. Premature rotation makes pending envelopes
undecryptable or challenge proofs unverifiable. Review retention/deletion for
expired challenges, rate-limit buckets and terminal delivery metadata before
production; terminal envelope erasure is implemented, scheduled metadata cleanup
is not. Do not claim cleanup automation that has not been deployed.

## Evidence and remaining release gates

CI builds/runs the worker image, checks real verification/recovery rendering,
and runs the PostgreSQL challenge and independent-connection delivery suites.
The delivery pool test clears its race timeout in `finally`, releases the
blocked provider and awaits dispatch even when an assertion fails; no detached
timeout should keep Jest alive. Record the final commit SHA and hosted run in
the PR body, and inspect the complete run for open-handle warnings.

Issue #75 still requires production-path real HTTP/PostgreSQL acceptance,
shared-budget and issuance/consumption race/collision evidence, replay/cooldown,
worker outages, provider timeout/retry recovery, measured account-enumeration
resistance under representative concurrency, and staging deployment validation.
A randomized response delay or isolated controller mocks do not prove those
properties. API-breaking DTO approval is distinct from security/deployment merge
approval. Revalidate signatures and CI after integrating the final foundation
into PR B; neither PR is authorized for merge by this document.
