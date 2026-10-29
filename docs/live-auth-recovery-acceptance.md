# Live authentication recovery acceptance (#75)

PR #113 replaces the closed, compromised PR #99. Its clean base is the protected
`dev` foundation merged through #111. Do not reuse the former branch heads.

## Automated evidence

`src/database/tests/auth-challenge-live-http.integration.spec.ts` uses actual
AuthService, guard, shared PostgreSQL budgets, challenge, delivery, audit,
password and persistence services, plus real JWT signing. Two independent Nest
applications have separate database pools. Only outgoing mail and routing are
replaced. The suite covers registration/verification/replay, recovery/session
revocation, both purpose boundaries, concurrent verification and resend,
supersession/cooldown, expiry/attempt limits, stale worker readiness, distributed
budgets, and provider timeout with retry recovery and envelope deletion.

The timing experiment rotates six account states across both HTTP applications,
uses twelve samples per state, and emits only aggregate durations. Its 200 ms
median-spread bound is a regression check, not proof against statistical account
enumeration. The existing randomized 350–599 ms floor remains provisional until
representative staging load demonstrates that underlying work stays below it.
Do not cite this synthetic experiment as production p99 evidence.

Run the PostgreSQL suites with PG_INTEGRATION_URL pointing to a disposable local
or CI database. They create isolated schemas; never use production credentials.
Without that variable, integration suites skip and do not constitute acceptance.

## Legacy credential retirement

1. Deploy additive foundation migrations and the configured, monitored worker
   before enabling the live producers. Validate the feature flag, HMAC pepper,
   encryption key, sender/template packaging and worker heartbeat.
2. Coordinate the challenge-ID contract with web/mobile clients. Legacy email/code
   verification and token-only password resets are rejected by DTO tests.
3. Drain all old API/worker instances; disable old producers. Invalidate outstanding
   legacy proofs or wait past their maximum lifetime. Never reactivate a legacy
   proof during rollback.
4. Retain the four nullable user columns during this compatibility window:
   verification_code, verification_code_expires_at, reset_token, reset_token_expiry.
   Live registration writes all four as NULL (asserted over HTTP/PostgreSQL);
   successful verification/reset clear their relevant legacy fields. Live proof
   validation reads only purpose-bound challenges.
5. After drain and reconciliation, null remaining legacy values in a separately
   reviewed migration. Before eventual column removal, verify no old deployed
   consumers remain, take a verified backup, rehearse on anonymized staging data,
   and add up/down migration tests. No destructive removal is included here.
6. Rollback disables producers first and preserves additive challenge/delivery and
   audit tables. A rollback must not expose legacy endpoints to populated raw codes.

## External acceptance still required

- Independent review of the full recovery diff, dependency/workflow scan results,
  and signatures on the final rewritten head. Existing PR #99 approvals do not transfer.
- Trusted breaking API approval and CI rerun on that signed head.
- Staging evidence for actual email delivery, provider timeout behavior, secrets,
  heartbeat/backlog/lease alerts, client adoption and rollback.
- Representative timing/load evidence, including login and all account states;
  expand samples if the observed distributions support account classification.

Keep #75 open and PR #113 draft until its complete acceptance matrix is satisfied.
