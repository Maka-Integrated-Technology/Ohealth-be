# #90 — Canonical patient personal-profile foundation

Status: **canonical public contract stacked on #80**. Depends on #80 for database-backed persona permissions and #78 for consistently created patient profiles. The login/refresh session integration is supplied by #77.

- Basic person-wide identity fields remain in `users`: first and last name, middle name, gender, date of birth and country.
- Patient residential/address data is added to `patient_profiles.address`, with an additive nullable migration. Existing users and clinical details remain unchanged.
- `CanonicalPatientProfileService` reads and updates these fields via the verified session user and session IDs; no public profile request accepts an actor ID.
- The update transaction re-checks active account status and patient persona under the user row lock. Identical patch requests produce no write. A newly created patient can populate their missing patient-profile record under the same lock.
- The DTO and normalization layer explicitly exclude email, phone, password, profile-photo URLs, medical conditions, emergency contacts, roles and status. Those need their own approved workflows.
- No new endpoint is added. `GET /api/auth/me` remains the #80 canonical account-context restoration contract and projects the same saved names, demographic fields, country, avatar and patient address. `PATCH /api/auth/me` is patient-only and delegates to the transactional personal-profile service.
- The generic patch accepts only first, last and middle name, gender, date of birth, country and address. Email, phone, password, avatar, medical fields, personas, roles and account state are immutable at this boundary. Unknown and empty bodies are rejected by the global validation/normalization boundary.
- Address is personal data, not protected clinical data. It follows the patient profile/account retention lifecycle and is never included in logs, caches, queue jobs or analytics.

Existing rows are backfilled as `NULL`; clients may populate an address on their next explicit profile update. The additive migration preserves all identity and clinical columns. Verification covers unit authorization/normalization, atomic persistence and rollback, repeat updates, migration preservation, OpenAPI compatibility, and generated-client drift.
