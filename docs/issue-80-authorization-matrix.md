# #80: canonical authentication context and authorization matrix

**Status: foundation/draft.** Auth context is server-derived from active account state, active `user_personas`, `organization_memberships` joined to their organizations, and verification records. The legacy JWT role array must not add capabilities. Final session claim shape, sign-in/refresh response and controller migration depend on #77.

## Deny-first rules

1. Account absent, `pending_verification`, `suspended`, `deactivated`, or email unverified: **no authenticated capabilities**. The existing access policy rejects the request.
2. A user may have multiple personas and memberships; permissions are **not interchangeable**. Patient capabilities do not confer clinician or organization privileges.
3. A professional persona **alone** confers no consultation management. Both the professional record and its verification must be active and verified.
4. An organization role is always scoped to the **requested organization ID**; a client-provided organization ID is a resource selector, never an authorization grant.
5. Pending, submitted, under-review, rejected or inactive organizations give **no operational capabilities**, even to their owner. Suspended, invited and removed memberships also have none.
6. `permission_overrides`, legacy global roles, client-supplied personas, routing targets and JWT role arrays do not independently grant privileged capabilities.
7. Platform administrator/staff policies remain **explicitly not enabled** by this foundation. Do not infer either from `User.role`, organization owner, or a verified professional.
8. Use the server's current database state for authorization on every protected action; do not trust cached client context or a previous login response. Cross-organization access must produce 403.

## Current capability matrix (implemented internal resolver)

| Actor/context                                                                   | Preconditions                                                                       | Allowed capabilities                                                                     | Explicitly denied                                                         |
| ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Patient                                                                         | Active account, verified email, active patient persona                              | `patient.profile.read`, `patient.profile.update`                                         | Medical/contacts/photos settings and organization/clinical administration |
| Healthcare professional (pending/rejected/inactive)                             | Active account, active professional persona, **not** verified active professional   | None                                                                                     | `professional.consultations.manage`                                       |
| Healthcare professional (approved)                                              | Active account, active professional persona and verified active professional record | `professional.consultations.manage`                                                      | Patient/organization/platform privileges not separately granted           |
| Hospital/laboratory/pharmacy member                                             | Active account, active membership, organization active **and approved**             | `organization.dashboard.read` for that organization only                                 | Settings management, access to other organizations                        |
| Hospital/laboratory/pharmacy owner or admin                                     | All member preconditions and `owner`/`admin` membership role                        | `organization.dashboard.read`, `organization.settings.manage` for that organization only | Cross-organization operations and platform administration                 |
| Pending/rejected/inactive organization, or invited/suspended/removed membership | Any organization type                                                               | None                                                                                     | Dashboard and settings for that organization                              |
| Platform admin/staff                                                            | Requires separate audited platform-staff authorization model not yet implemented    | None from this foundation                                                                | Any implicit privilege based on legacy `ADMIN` or `role`                  |
| Suspended/deactivated/unverified user                                           | Any persona or organization                                                         | None                                                                                     | All authenticated actions                                                 |

**Note:** `organization.dashboard.read` and `organization.settings.manage` are deliberately generic scopes. Domain-specific clinical, lab, pharmacy, and payment actions require additional resource-specific guards and review: do not extend these names to imply approval to read patient medical records.

## Public API transition plan (blocked until #77)

- Issue #77 will provide canonical session identity, refresh and revocation. Until then, no new JWT capabilities or additional session issuer is introduced.
- Return `account_status`, `email_verified`, `personas`, `professional_verification_status`, `organizations[]` and `capabilities[]` in an **additive, version-reviewed** response for login and refresh.
- Keep frontend navigation details out of the canonical contract. Remove legacy `routing_target` and global role reliance only after the web/mobile clients are migrated and OpenAPI generated-client checks are reviewed.
- Migrate protected controllers in small, audited steps using `assertOrganizationCapability(actorId, resourceOrgId, capability)` and patient read/write assertions. Tests must include false membership, mismatched organization IDs, rejected verification, stale sessions and account revocation.
- Versioned deployment requires backend checks to be in place **before** frontend role-based navigation changes.

## Evidence and uncompleted acceptance

This foundation includes resolver/unit tests covering denied account states, patient/professional status, approved versus pending organizations, cross-organization 403, and the legacy ADMIN non-grant. Remaining work: login/refresh wiring, actual domain guards, staff/platform policies, HTTP/e2e matrix verification, stale-token and revocation regression, OpenAPI/client updates, and final security approval.
