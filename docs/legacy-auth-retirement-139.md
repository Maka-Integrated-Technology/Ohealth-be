# Issue #139: legacy authentication retirement on backend `dev`

Owner: backend identity/auth. This inventory is the review record for the `dev` contract break. The canonical consumer handoff is prepared after #163; staging and production promotion require consumer migration and #114 validation.

## Removed-surface matrix

| Retired surface | Decision and replacement | Consumer impact |
| --- | --- | --- |
| `POST /auth/google-login` and `GoogleLoginDto` | Delete the old direct ID-token path, including its 410 compatibility response. Use nonce-bound `POST /auth/oauth/google/transactions` then `POST /auth/oauth/google/complete` (or the browser completion). | Dashboard and mobile still call the old path. |
| `PATCH /auth/users/{user_id}/activate` | Delete the guarded compatibility route. Only purpose-bound `POST /auth/verify` can prove contact and activate a pending account. This route was excluded from OpenAPI. | Mobile still calls it after verification. |
| `POST /pharmacies/register`, `CreatePharmacyDto`, `PharmacyResponseDto`, `PharmacyController_register` | Delete the public parallel registration service and route. Pharmacy intent through `POST /auth/signup` transactionally creates the pending account, pharmacy organization, owner membership, legal acceptances and contact challenge. The legacy `pharmacies` table is retained for reconciliation; this code cannot reserve identifiers. | No direct caller found in the checked dashboard, patient web or mobile source; any external caller must migrate. |
| `AuthController_googleLogin` generated-client export | Delete with the endpoint. | Regenerate clients from this OpenAPI revision. |
| Legacy `user.role` in login, verification, refresh, MFA and OAuth session responses | Delete. Read `account_context.personas`, `memberships`, `capabilities` and `account` from the server-resolved canonical response. | Dashboard and mobile auth types still assume a top-level role. |
| `routing_target`, `access_level`, top-level `verification_status` in mobile/browser auth responses | Delete backend navigation policy. Clients derive screens from canonical context and their own navigation rules. Professional and organization verification states remain inside canonical context. | Dashboard still declares `routing_target` and `access_level`; mobile has legacy route selection. |
| Flat `GET/PATCH /auth/me` profile fields (`id`, names, email, role, gender, date of birth, phone, country, image, activity and timestamps) | Delete compatibility duplicates. Use `account_context.account` and `account_context.account.profile`. Patient `address` remains an explicit canonical M02 field, null without a patient persona. | Dashboard and mobile auth profile types and settings adapters need migration. |
| `RolesGuard`, `@Roles`, role-subset utility, frontend routing enum/presenter | Delete. Protected patient/professional routes use current server-derived capabilities, persona state and resource relationships. | No supported API replacement for role claims. |
| `UserService` raw verification and reset helpers, old proof generator | Delete. Contact/login/recovery challenges are purpose-bound, hashed, limited and atomically consumed through the canonical challenge service. | Old raw code/token payloads cannot be used. |
| Unused `UserService.create`, `replaceAuthenticatedPassword` and `linkGoogleIdentity` mutations | Delete paths that bypass canonical provisioning, password policy/session revocation/audit, or external-identity linking. Use registration, password settings and OAuth services. | No supported HTTP contract or current caller. |
| `AuthService.issueAuthSession` | Delete unused direct session-issuance compatibility method. Canonical flows issue sessions after required proofs. | No HTTP contract. |
| Legacy proof clearing in canonical verification, recovery and password change | Delete runtime writes to old fields. The migration clears old values and the database constraint rejects repopulation. | Old proofs are invalidated. |
| Legacy `users.role` writes in account provisioning and booking seed | Delete. Personas, memberships and platform privileges are the only authorities. | Seed users must have canonical personas/memberships. |

`POST /auth/signup`, `/auth/verify`, `/auth/login`, `/auth/login/verify`, `/auth/login/mfa/verify`, recovery, OAuth transaction, refresh, browser session, logout, email change, password change, profile and profile-photo routes are canonical and remain. `POST /laboratories/auth/admin-setup` and `POST /organizations/onboarding/admin-setup` are platform-privileged organization administration, not anonymous self-service; both create pending users and queue the same canonical contact-verification challenge without issuing a session. Laboratory staff invitation acceptance is a purpose-bound organization invitation operation and is outside this self-service retirement. Professional onboarding and clinical resources remain in their owning domains.

## Schema and rollback

Migration `RetireLegacyAuthProofs1795500000000` clears `users.verification_code`, `verification_code_expires_at`, `reset_token` and `reset_token_expiry` and adds `CHK_users_retired_auth_proofs_inert`. It also removes the default and `NOT NULL` requirement from `users.role`, so new accounts do not acquire a synthetic `PATIENT` role. The `User` entity no longer maps these columns or `role`, so ordinary TypeORM reads and writes omit them. The check rejects direct SQL, worker or maintenance attempts to write proofs. `down` removes the proof check but does not restore expired plaintext proofs or reintroduce a global role default; any rollback to a role-dependent binary requires an explicitly reviewed identity backfill.

Backend identity owns these four rollback-only columns, `users.role`, `users.google_id`, the old `pharmacies` table, and the legacy `users.is_active`/`is_verified` mirrors. Existing role values are retained for reconciliation but no new value is written. `users.google_id` is retained only for rollback reconciliation; runtime identity resolution uses `external_identities`, and the `User` entity no longer maps the column. The mirrors remain for rollback but account admission uses `account_status` and `email_verified_at`. Physical removal waits for coordinated consumer migration, #114 staging evidence, a verified backup, identity/pharmacy and external-identity data reconciliation and an approved destructive contract migration. No applied migration was edited. Canonical session, challenge, legal-acceptance, audit and retention tables are untouched.

## Consumer migration notes

- Dashboard: `app/features/auth/api.ts` calls `/api/auth/google-login`; `app/features/auth/types.ts` still declares role, `routing_target` and `access_level`. Migrate to OAuth transactions and canonical account context. Existing registration code also sends a `role` claim, which canonical signup rejects.
- Mobile: `features/auth/services/auth.ts` calls `/auth/google-login` and `/auth/users/{id}/activate`, and `features/auth/types/auth.ts` expects a role array. Use OAuth transactions, contact challenge verification and canonical context. `features/auth/validationSchema.ts` still models a client-chosen role and must use signup intent.
- Patient web: no direct removed-route reference found in the checked source. Its auth integration must still be validated against the final post-#163 contract.
- No pharmacy registration call was found in these three checked consumer sources. External callers, if any, must use pharmacy signup intent before staging promotion.

## Acceptance evidence map

| Criterion | Evidence |
| --- | --- |
| Old activation, Google login and pharmacy registration return 404 | `test/auth-activation.e2e-spec.ts` over real HTTP; OpenAPI path/client export diff |
| No raw proof reader/writer or repopulation | Source inventory, TypeORM unmapped columns, `retire-legacy-auth-proofs.integration.spec.ts` against PostgreSQL, and the full `auth-challenge-live-http.integration.spec.ts` run after the retirement migration |
| Canonical authorization and blocked accounts | Existing context, capability, live auth HTTP/PostgreSQL, and account-policy suites; new platform privilege test denies forged legacy admin role |
| Canonical signup/session/recovery/OAuth/MFA/profile regressions | Auth HTTP/PostgreSQL matrix on the migrated schema, including null legacy role and proof assertions, and focused e2e suites |
| Contract and generated client | `contract:check`, `contract:validate`, `contract:compatibility:test`, `api-client:check`, `api-client:test`; validator tests reject both retired operation IDs even with bearer security |
