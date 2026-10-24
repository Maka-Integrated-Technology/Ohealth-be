# Credential sign-in and shared password policy (#76)

## Disclosure and login work

- Unknown email and wrong password return the same HTTP 401 and the same
  `invalid credentials` message. No account status is inspected before a
  correct password is proved.
- Every syntactically valid credential login performs bcrypt comparison.
  Unknown, absent-password, and corrupt-hash accounts compare against a
  configured-cost dummy bcrypt hash prepared before HTTP traffic starts.
  Its password is public and does not belong to any user. This reduces missing-user timing differences but does not
  guarantee identical wall-clock latency (database lookup/cache and existing
  hash costs can differ).
- Only *after* successful password proof does the existing canonical account
  policy (#74) decide whether login is allowed. A valid password for a
  suspended, deactivated, or unverified account remains denied. Never reveal
  that status on an invalid password.
- Credential login logs only generic success; password values, bearer tokens,
  reset codes, dummy hash, and request bodies are not logged.
- Login input is bounded at **1024 UTF-8 bytes** before database lookup or bcrypt. Oversized
  input produces the same generic 401 regardless of whether the email exists.

## Password-setting contract

One reusable `PasswordCredentialsService` and `IsSecurePassword`
DTO validator enforce the same policy for legacy signup, intent-based
registration contracts (#78), laboratory/organization administrator setup,
reset completion (#75), authenticated password change (#77), and laboratory
staff invitation acceptance.

- Minimum **8 characters** remains an unresolved merge blocker: before
  approval adopt a NIST SP 800-63B single-factor minimum of 15 characters,
  drop composition rules, block compromised passwords, support 64+ characters,
  and document the bcrypt 72-byte migration strategy.
- Maximum **72 UTF-8 bytes** (bcrypt's effective input boundary).
- At least one ASCII uppercase letter, lowercase letter, and number.
- No automatic trimming, normalization, or silent truncation.
- User-input policy validation happens **before hashing**; direct service
  calls cannot bypass DTO validation.
- Bcrypt work factor remains controlled by `HASH_SALT`, validated to be
  an integer between 10 and 14 (default 10).
- Server-generated random OAuth placeholder credentials use the same
  hashing boundary but are exempt from the user password-complexity rule.

The missing-account dummy hash uses the configured HASH_SALT value.
Existing bcrypt account hashes with different historical costs may still
have different timings; migrate their work factors and enforce rate limiting. Do not introduce password logging to
diagnose authentication failures.

## Scope boundaries

- Issue #75 owns challenge storage, delivery, reset flow and rate limiting.
- Issue #77 owns session rotation, revocation and security events.
- Issue #78 owns transactionally orchestrated, intent-based registration.
- This PR exposes the reusable policy for those issues without attempting
  to implement their larger flows.

## Test evidence to review

- Unit tests cover identical missing-account/wrong-password error semantics,
  bcrypt comparison path, limits, Unicode byte overflow and every DTO.
- Isolated HTTP tests check identical 401 bodies, account state disclosure only
  after correct password, pathological inputs, and no secret logging.
- All existing unit, activation-security and PostgreSQL migration tests should
  remain green. CI security audit and signed-commit approval remain mandatory.
