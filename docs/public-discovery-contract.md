# Public discovery contract and visibility policy (Issue #141)

Public discovery lets unauthenticated web and mobile consumers browse
specialities and approved healthcare professionals. This document defines the
boundary every public discovery endpoint must use. It is the foundation for the
speciality catalogue (#142), professional directory (#143), professional
details (#144), and availability (#145); those issues add endpoints, not new
rules.

Status: **Foundation**. The boundary, policy, query conventions, and response
models are implemented and tested. The only live route is the contract
endpoint below.

## Boundary

- Module: `src/modules/public-discovery`.
- Route namespace: `/api/public/...`. Planned resources are
  `/api/public/specialities` and `/api/public/professionals`.
- A controller joins the boundary with `@PublicDiscoveryRoutes('<resource>')`,
  which sets the namespace, marks the routes public, and applies the
  `Public Discovery` OpenAPI tag.
- The namespace is read-only. The OpenAPI validator rejects any operation under
  `/api/public/` that is not a `GET`, declares a security requirement, or is
  missing the tag, and every public operation must still be listed explicitly
  in `PUBLIC_OPERATION_IDS`.
- `SpecialityController` and `ProfessionalController` are unchanged. Their
  authenticated, owner, reviewer, and admin operations keep their guards.
  Public discovery must never be delivered by removing a guard from them.
- The module defines no tables. `specialities`, `professionals`,
  `professional_availabilities`, and `users` remain the source of truth.

Public routes do not evaluate credentials. A request that carries an
`Authorization` header is answered exactly like an anonymous one, and no
client-supplied identity, role, or status takes part in any decision.

## Visibility policy

`PublicDiscoveryVisibilityPolicy` is the only place that decides what is
discoverable. It exposes the rule in two forms that are tested for agreement on
real PostgreSQL: query predicates (`applySpecialityVisibility`,
`applyProfessionalVisibility`) and in-memory checks (`isSpecialityVisible`,
`isProfessionalVisible`).

| Resource     | Visible only when                                                                                                                                                               |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Speciality   | `specialities.is_active = true`                                                                                                                                                 |
| Professional | `professionals.is_active = true`, `verification_status = 'verified'`, owning `users.account_status = 'active'`, `users.email_verified_at` is set, and its speciality is visible |

Missing or unknown state fails closed. `is_available` is not a visibility
condition: a visible professional who is not currently taking bookings is
still listed, with `is_available: false`.

`profile_setup_completed` is deliberately not part of the rule. It tracks
onboarding progress for the professional's own dashboard; verification
approval is the publication gate. Changing that requires updating this policy
and document together.

## Non-enumerating errors

A resource that is missing, malformed, inactive, unapproved, suspended, or
deactivated produces one identical response:

```json
{
  "status_code": 404,
  "message": "Resource not found",
  "error": "Not Found",
  "error_code": "PUBLIC_RESOURCE_NOT_FOUND",
  "data": null
}
```

Handlers throw `PublicResourceNotFoundException` and bind identifiers with
`PublicResourceIdPipe`, which reports a malformed identifier as not found
before any query runs. Public handlers must not return 403, a distinct
"inactive" message, or a validation error for an identifier.

## Query conventions

Query DTOs live in `dto/public-discovery-query.dto.ts` and are validated by the
global pipe, which also rejects unknown parameters. Each parameter has one
validation rule and therefore one message.

| Parameter           | Rule                                                                           |
| ------------------- | ------------------------------------------------------------------------------ |
| `page`              | Integer 1–1000, default 1                                                      |
| `limit`             | Integer 1–50, default 20                                                       |
| `q`                 | Text, 2–100 characters after NFKC normalization, trimming, and space collapse  |
| `speciality_id`     | UUID from the public speciality catalogue                                      |
| `consultation_type` | `chat`, `video`, or `both`                                                     |
| `sort`              | `rating` (default), `experience`, `consultation_fee`, or `name`                |
| `order`             | `asc` or `desc` (default)                                                      |
| `from`, `to`        | `YYYY-MM-DD` calendar dates; `to` ≥ `from`; inclusive range of at most 31 days |

A blank `q` means no search. Sort values are an allowlist mapped to columns by
the server; a sort value is never interpolated into SQL. Endpoints must add a
unique tiebreaker (the identifier) so ordering and pagination are deterministic.

Consumers can read these limits at runtime:

```http
GET /api/public/discovery/contract
```

```json
{
  "status_code": 200,
  "message": null,
  "data": {
    "pagination": { "default_limit": 20, "max_limit": 50, "max_page": 1000 },
    "search": { "min_length": 2, "max_length": 100 },
    "professional_sort": {
      "fields": ["rating", "experience", "consultation_fee", "name"],
      "orders": ["asc", "desc"],
      "default_field": "rating",
      "default_order": "desc"
    },
    "consultation_types": ["chat", "video", "both"],
    "max_availability_range_days": 31
  }
}
```

## Response models

Public responses are explicit allowlists in
`dto/public-discovery-response.dto.ts`, populated only by the functions in
`public-discovery.mapper.ts`. Entities are never serialized directly.

| Model                          | Fields                                                                                                                                                      |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PublicSpecialityDto`          | `id`, `name`, `description`, `icon`                                                                                                                         |
| `PublicProfessionalSummaryDto` | `id`, `name`, `image`, `speciality { id, name }`, `rating`, `total_reviews`, `consultation_fee`, `years_of_experience`, `consultation_type`, `is_available` |
| `PublicProfessionalDetailDto`  | Summary fields plus `about`                                                                                                                                 |
| `PublicAvailabilityDayDto`     | `date`, `slots [{ id, start_time, end_time }]`                                                                                                              |
| `PublicPaginationMetaDto`      | `page`, `limit`, `total`, `total_pages`, `has_next`, `has_previous`                                                                                         |

Paginated endpoints return `{ "items": [...], "meta": PublicPaginationMetaDto }`
inside the standard `data` envelope.

Never exposed: email, phone, date of birth, license number, verification
documents or reasons, verification status, account status, roles or personas,
organization membership, user identifier, patient data, booking identities,
audit data, storage keys, and row timestamps.

`image` is published only when the stored value is an absolute HTTPS address
without embedded credentials. Storage keys, relative paths, and other schemes
are returned as `null`.

## Deferred to later issues

- Rate controls and indexes for the public surface are delivered and verified
  in #146. Until then the namespace exposes only the static contract endpoint.
- Compatibility aliases are not provided; no existing consumer depends on a
  public discovery route.

## Verification

```bash
npx jest src/modules/public-discovery src/openapi
npx jest --config ./test/jest-e2e.json --runInBand test/public-discovery-boundary.e2e-spec.ts
PG_INTEGRATION_URL=postgres://postgres:postgres@localhost:5432/ohealth_ci \
  npx jest --runInBand src/database/tests/public-discovery-visibility.integration.spec.ts
npm run contract:check && npm run api-client:test
```
