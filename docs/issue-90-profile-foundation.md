# #90 — Canonical patient personal-profile foundation

Status: **foundation, not yet the public contract**. Depends on #80 for database-backed persona permissions and #78 for consistently created patient profiles. The final login/refresh session integration is supplied by #77.

- Basic person-wide identity fields remain in `users`: first and last name, middle name, gender, date of birth and country.
- Patient residential/address data is added to `patient_profiles.address`, with an additive nullable migration. Existing users and clinical details remain unchanged.
- `CanonicalPatientProfileService` reads and updates these fields via a server-resolved user ID; never accept an ID from a public profile request.
- The update transaction re-checks active account status and patient persona under the user row lock. Identical patch requests produce no write. A newly created patient can populate their missing patient-profile record under the same lock.
- The DTO and normalization layer explicitly exclude email, phone, password, profile-photo URLs, medical conditions, emergency contacts, roles and status. Those need their own approved workflows.
- No new endpoint is added. Existing `GET/PATCH /api/auth/me` continues to operate until an audited compatibility and OpenAPI/client migration converts it to use this same service.

**Remaining:** wire the existing endpoint without creating a second public API; supply address backfill policy, real PostgreSQL rollback/concurrency testing, verified-session ownership tests, OpenAPI/client compatibility checks, and the canonical session prerequisites. Do not merge this PR until those checks and migration readiness are confirmed.
