# OHealth credential sign-in and password policy (#76)

## Login privacy

- Unknown identities and incorrect passwords return the same generic 401.
- Account-state information is disclosed only after successful password proof.
- The login boundary applies its 1024-byte limit **after NFC normalization**
  before the database lookup, with an additional 8192-byte raw-input guard
  against pathological requests. Composed/decomposed equivalents of a valid
  versioned password authenticate identically.
- Legacy bcrypt verification continues to use **raw**, unnormalized bytes
  and a strict 72-byte limit; no legacy password is silently migrated.
- For bounded input, every login uses one bcrypt comparison, including
  nonexistent accounts, invalid stored hashes, and legacy/modern accounts.
- A dummy hash is prepared during Nest initialization with the configured
  HASH_SALT (cost 10 through 14); it is not a user credential.
- Historical account hashes at different cost factors can still have different
  timings. Rate limiting (#75) and gradual rehash-on-credential-change are
  important deployment follow-ups.
- No passwords, reset codes, bearer tokens, or request payloads in auth logs.

## Password setting

- Single-factor passwords require **15 Unicode code points** minimum, counted
  after NFC normalization, and permit **at least 64 characters**.
- The current upper bound is 1024 UTF-8 bytes after normalization.
- No composition rules, trimming, or silent truncation.
- A reproducibly generated whole-password blocklist rejects compromised,
  common and context-specific credentials. Its source is the published UK
  NCSC 100k-most-used password corpus distributed by MIT-licensed SecLists,
  pinned to Git blob `38eb37702244f55fda75cab281eb2145cd7685b6`.
  Values meeting the 15-character rule, bounded common whole-password
  suffix variants, and reviewed OHealth context entries are compared against
  the entire normalized candidate (never a substring).
- Source, generator and generated module are versioned in this repository.
  `npm run password-blocklist:check` is required by CI, and checks the
  pinned source fingerprint and deterministic generated output; see
  `security/password-blocklist/README.md` for the update procedure.
- DTO validation and PasswordCredentialsService use the same policy across
  patient/professional signup, intent-based registration DTOs, laboratory and
  organization administration, lab staff invitations, reset, and change.

## Versioned hashing and migration

- New user-chosen passwords are stored in version
  `ohealth$bcrypt-sha256$v1$` followed by a normal bcrypt hash.
- Before bcrypt, the complete NFC-normalized password is SHA-256 hashed with
  a domain-separation label and the unique bcrypt salt. The 43-character
  base64url digest fits bcrypt without losing any original password bytes.
- Existing `$2a$`, `$2b$` and `$2y$` bcrypt hashes remain accepted for
  passwords of up to 72 UTF-8 bytes, without accepting input that matches
  solely due to bcrypt truncation beyond byte 72.
- Reset/change-password writes the versioned format and is the migration path.
  Do not silently switch legacy accounts at login without a documented
  transactional migration, session strategy, and audit trail.
- Server-generated OAuth placeholder secrets may remain legacy bcrypt.
- Performance of work factor 10–14 and existing mixed-cost legacy hashes
  must be validated in deployment conditions.

## Remaining security work and release criteria

- Maintain/review NCSC source updates and contextual blocked values using the
  documented reproducible workflow; review list breadth periodically and
  consider additional trusted breach corpora when newly available.
- Document frontend/API changes: signup, reset, change, laboratory staff,
  and all other password forms now enforce 15+ characters.
- Finish #75 request-rate limits/recovery, #77 session security, and #78
  full registration orchestration separately; do not accidentally expand #76.
- Regenerate/check OpenAPI and client contracts, run unit/e2e/integration
  checks, formatter, linter, audit, and independent security re-review.
- Do not merge or deploy while tests, blocklist coverage, or approval
  requirements are outstanding.
