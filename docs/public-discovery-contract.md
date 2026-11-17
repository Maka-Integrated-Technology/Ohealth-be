# Public discovery contract and visibility policy (Issue #141)

Public discovery lets unauthenticated web and mobile consumers browse
specialities and approved healthcare professionals. This document defines the
boundary every public discovery endpoint must use. It is the foundation for the
speciality catalogue (#142), professional directory (#143), professional
details (#144), and availability (#145); those issues add endpoints, not new
rules.

Status: **Foundation**. The boundary, policy, query conventions, and response
models are implemented and tested. The live routes are the contract endpoint,
the speciality catalogue (#142), the professional directory (#143),
professional details (#144), and professional availability (#145) described
below.

## Boundary

- Module: `src/modules/public-discovery`.
- Route namespace: `/api/public/...`. `/api/public/specialities`, the
  `/api/public/professionals` directory, `/api/public/professionals/:id`, and
  `/api/public/professionals/:id/availability` are live.
- A public controller lives in the module that owns its data and reads through
  that module's service, for example `PublicSpecialityController` in
  `src/modules/speciality`. The owning module imports `PublicDiscoveryModule`
  for the policy, pipe, DTOs, and mappers.
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
  `professional_availabilities`, `bookings`, and `users` remain the source of
  truth.

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

| Parameter            | Rule                                                                                                                                 |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `page`               | Integer 1–1000, default 1                                                                                                            |
| `limit`              | Integer 1–50, default 20                                                                                                             |
| `q`                  | Text, 2–100 characters after NFKC normalization, trimming, and space collapse                                                        |
| `speciality_id`      | UUID from the public speciality catalogue                                                                                            |
| `consultation_type`  | `chat`, `video`, or `both`                                                                                                           |
| `min_fee`, `max_fee` | Plain amounts 0–99999999.99 with at most two decimal places; `max_fee` ≥ `min_fee`                                                   |
| `sort`               | `rating` (default), `experience`, `consultation_fee`, or `name`                                                                      |
| `order`              | `asc` or `desc` (default)                                                                                                            |
| `from`, `to`         | Required `YYYY-MM-DD` calendar dates; `to` ≥ `from`; inclusive range of at most 31 days; `to` must not have ended in every time zone |

A blank `q` means no search. Sort values are an allowlist mapped to columns by
the server; a sort value is never interpolated into SQL. Endpoints must add a
unique tiebreaker (the identifier) so ordering and pagination are deterministic.

A query parameter that takes an enum declares the enum's `enumName`, so the
OpenAPI parameter references the named schema (`ConsultationType`,
`PublicProfessionalSortField`, `PublicSortOrder`). An inlined enum makes the
generated client rename its exported enum after the path; the client runtime
test fails if that happens in the public namespace.

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
    "max_availability_range_days": 31,
    "max_availability_slots": 500
  }
}
```

## Response models

Public responses are explicit allowlists in
`dto/public-discovery-response.dto.ts`, populated only by the functions in
`public-discovery.mapper.ts`. Entities are never serialized directly.

| Model                               | Fields                                                                                                                                                      |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PublicSpecialityDto`               | `id`, `name`, `description`, `icon`                                                                                                                         |
| `PublicProfessionalSummaryDto`      | `id`, `name`, `image`, `speciality { id, name }`, `rating`, `total_reviews`, `consultation_fee`, `years_of_experience`, `consultation_type`, `is_available` |
| `PublicProfessionalDetailDto`       | Summary fields plus `about`                                                                                                                                 |
| `PublicProfessionalAvailabilityDto` | `from`, `to`, `as_of`, `days [PublicAvailabilityDayDto]`, `has_more`                                                                                        |
| `PublicAvailabilityDayDto`          | `date`, `slots [{ id, start_time, end_time, time_zone, starts_at, ends_at }]`                                                                               |
| `PublicPaginationMetaDto`           | `page`, `limit`, `total`, `total_pages`, `has_next`, `has_previous`                                                                                         |

Paginated endpoints return `{ "items": [...], "meta": PublicPaginationMetaDto }`
inside the standard `data` envelope.

Never exposed: email, phone, date of birth, license number, verification
documents or reasons, verification status, account status, roles or personas,
organization membership, user identifier, patient data, booking identities,
booking status, notes, and payment data, which professional a slot row belongs
to, a slot's stored availability flag, audit data, storage keys, and row
timestamps.

`icon` is an asset identifier that consumers map to an icon they bundle. It is
published only when the stored value is at most 64 characters of lower-case
letters and digits in hyphen-separated groups, such as `general-doctor`. File
names, paths, addresses, storage keys, and every other stored value are
returned as `null`. The protected speciality write contract is unchanged, so a
value stored outside this format stays visible to authenticated consumers and
is withheld only from public responses.

`image` is published only when the stored value is an absolute HTTPS address
without embedded credentials. Storage keys, relative paths, and other schemes
are returned as `null`.

### Stored text

Names, speciality names, descriptions, and biographies are written by
professionals and administrators, and the protected write contracts accept any
string. They reach a public response only through `public-discovery.text.ts`,
as plain text that cannot open markup even in a consumer that wrongly renders
it as HTML. Consumers must still render every text field as text.

| Kind                              | Fields                                                                            | Rule                                                                                                                                                                                                                                              |
| --------------------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Label (`toPublicLabel`), required | Professional `name`, speciality `name` in the catalogue and inside a professional | One line. Control and bidirectional override characters are removed, whitespace is collapsed, any `<` that would open a tag, comment, or declaration is dropped, and the value is cut to 200 characters. A value that is not text becomes `""`.   |
| Prose (`toPublicProse`), optional | Professional `about`, speciality `description`                                    | Published exactly as written apart from removed control and bidirectional override characters and normalized line endings, or not at all: text that is empty, longer than 4000 characters, or contains the start of markup is returned as `null`. |

"The start of markup" is `<` followed by a letter, `/`, `!`, or `?`, which is
what an HTML parser reads as a tag, comment, or declaration. `a < b`,
`BMI > 30`, `<3`, `&`, and character references are ordinary text and are
returned as written. Lengths count characters, not UTF-16 code units.

A biography states a professional's qualifications, so it is never rewritten:
it is published as written or withheld. A name must always be present, so it
is neutralized instead. Stored text is never placed in the OpenAPI document or
the generated client; their examples are fixed strings. The protected write
contracts are unchanged, so a withheld value stays visible to its owner on the
authenticated routes.

## Speciality catalogue (Issue #142)

`PublicSpecialityController` serves the catalogue from the existing
`specialities` table through `SpecialityService`. No table, entity, or column
was added, and `SpecialityController` keeps its guards and behaviour.

| Operation                          | Query                | Response                                          |
| ---------------------------------- | -------------------- | ------------------------------------------------- |
| `GET /api/public/specialities`     | `page`, `limit`, `q` | `{ items: PublicSpecialityDto[], meta }`          |
| `GET /api/public/specialities/:id` | —                    | `PublicSpecialityDto`, or the non-enumerating 404 |

- Only visible (active) specialities are returned. An inactive speciality is
  absent from the list, from search results, and from the total, and its
  identifier answers with the same 404 as a missing or malformed one.
- Order is `LOWER(name)` ascending, then `id` ascending. The identifier makes
  the order total, so pages never repeat or skip a row.
- `q` matches any part of the name without regard to case. `%`, `_`, and `\`
  in a term are matched literally; a term cannot act as a pattern.
- `specialities.name` is unique by exact value, so names that differ only by
  case are distinct stored rows and are listed as distinct entries. The
  catalogue does not merge, rename, or re-case them.
- A page beyond the last one returns `items: []` with the real `total`.
- Each request runs one page query and one count query, selecting only `id`,
  `name`, `description`, and `icon`. No related rows are loaded.
- Unknown query parameters, including `sort` and `is_active`, are rejected
  with a 400.

The `id` returned here is the canonical `speciality_id` filter for the
professional directory (#143).

## Professional directory (Issue #143)

`PublicProfessionalController` serves the directory from the existing
`professionals`, `users`, and `specialities` tables through
`PublicProfessionalService` in `src/modules/professional`. No table, entity,
or column was added, and `ProfessionalController` keeps its guards and
behaviour.

| Operation                       | Query                                                                                             | Response                                          |
| ------------------------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| `GET /api/public/professionals` | `page`, `limit`, `q`, `speciality_id`, `consultation_type`, `min_fee`, `max_fee`, `sort`, `order` | `{ items: PublicProfessionalSummaryDto[], meta }` |

- Every request applies `applyProfessionalVisibility`. A professional who is
  inactive, unapproved, owned by a non-active or unverified account, or in an
  inactive speciality is absent from the items, from every filter and search,
  and from the total. Legacy `users.role` values take no part.
- `q` matches any part of the display name (`first_name`, a space,
  `last_name`) or of the speciality name, without regard to case. `%`, `_`,
  and `\` are matched literally. Biography, email, phone, licence, and country
  are not searched.
- `speciality_id` is the `id` from the speciality catalogue. An unknown or
  inactive speciality yields an empty page, not an error.
- `consultation_type=chat` or `video` also returns professionals stored as
  `both`, because they offer that mode. `consultation_type=both` returns only
  professionals who offer both.
- `min_fee` and `max_fee` are inclusive bounds on `consultation_fee`. Signs,
  exponents, separators, and more than two decimal places are rejected.
  `consultation_fee` has no stored currency; amounts are compared as stored.
- Sorting uses fixed server-side expressions selected by the `sort` allowlist:
  `rating`, `experience` (`years_of_experience`), `consultation_fee`, and
  `name` (`LOWER(first_name)`, then `LOWER(last_name)`). `order` applies to
  those expressions; ties are always broken by `id` ascending, so pages never
  repeat or skip a row.
- Pagination is page-based with the shared meta. There is no cursor. A page
  beyond the last one returns `items: []` with the real `total`.
- Each request runs one page query and one count query. The two joins are
  to-one, and only the columns of the public summary are selected.
- Unknown parameters are rejected with a 400. That includes `location`,
  `country`, `is_available`, and any account or verification state.

**Location is not a supported filter.** A professional has no canonical
practice location. `users.country` is the account holder's country of
residence, collected as free text for the account, so it is neither published
nor filterable. Adding a location filter requires a canonical location on the
professional profile first.

**Availability.** The directory makes no promise about bookable times; slots
are served by the availability endpoint (#145). `is_available` in the summary
is the professional's stored "accepting consultations" flag from the #141
model. It is not a filter and does not affect visibility.

## Professional details (Issue #144)

`PublicProfessionalController` serves one professional through
`PublicProfessionalService.findOne`. No table, entity, or column was added,
and `ProfessionalController` keeps its guards and behaviour.

| Operation                           | Response                                                  |
| ----------------------------------- | --------------------------------------------------------- |
| `GET /api/public/professionals/:id` | `PublicProfessionalDetailDto`, or the non-enumerating 404 |

- `:id` is the `id` returned by the directory. `PublicResourceIdPipe` reports
  a malformed identifier, including `me`, as not found before any query runs.
- The professional is read through `applyProfessionalVisibility`, the same
  rule as the directory. A professional who is missing, inactive, pending,
  rejected, owned by a suspended, deactivated, or unverified account, or in an
  inactive speciality produces the identical 404. A hidden professional and a
  missing one run the same single statement.
- The response is the directory summary plus `about`: `id`, `name`, `image`,
  `speciality { id, name }`, `rating`, `total_reviews`, `consultation_fee`,
  `years_of_experience`, `consultation_type`, `is_available`, `about`.
  `consultation_fee` has no stored currency. There is no public practice
  location because none is stored.
- `rating` and `total_reviews` are aggregated from the `professional_reviews`
  records when the request is served: the average rating rounded to two
  decimal places and the number of reviews, or `0` and `0` when there are
  none. Individual reviews, comments, reviewers, and bookings are not read.
  Reviews have no moderation state today; when one is added, the aggregate
  must count only publishable reviews.
- The directory shows the stored summary (`professionals.rating`,
  `total_reviews`) because it sorts by it. The review write path recomputes
  that summary from the same records in the same transaction, so the two
  agree; if a stored summary ever drifts, the detail still reports the
  records.
- `name`, `speciality.name`, and `about` follow the stored-text rule above.
- A visible professional costs two statements: the profile with only its
  published columns, and the review aggregate. Availability is not returned;
  it is served by the availability route (#145).
- No mutation exists under the public route, and its only nested resource is
  `/availability`. There is no public `/reviews`, `/availabilities`, or
  `/bookings`.

## Professional availability (Issue #145)

`PublicProfessionalController` serves the open future slots of one
professional through `PublicProfessionalService.findAvailability`.
`ProfessionalController` and the booking flow keep their guards and behaviour.

| Operation                                        | Query        | Response                                                        |
| ------------------------------------------------ | ------------ | --------------------------------------------------------------- |
| `GET /api/public/professionals/:id/availability` | `from`, `to` | `PublicProfessionalAvailabilityDto`, or the non-enumerating 404 |

```json
{
  "from": "2026-01-15",
  "to": "2026-01-21",
  "as_of": "2026-01-14T10:30:00.000Z",
  "days": [
    {
      "date": "2026-01-15",
      "slots": [
        {
          "id": "3f2504e0-4f89-41d3-9a0c-0305e82c3301",
          "start_time": "09:00:00",
          "end_time": "09:30:00",
          "time_zone": "Africa/Lagos",
          "starts_at": "2026-01-15T08:00:00.000Z",
          "ends_at": "2026-01-15T08:30:00.000Z"
        }
      ]
    }
  ],
  "has_more": false
}
```

### Availability is information, not a reservation

A response describes the slots that were open at `as_of`. A slot can be taken
at any moment afterwards, and knowing a slot `id` reserves nothing. Booking
creation must revalidate the slot and reserve it atomically, and it can refuse
a slot that a public response listed. The OpenAPI operation and the
`PublicProfessionalAvailabilityDto` schema state this, the generated-client
test fails if either stops saying so, and the response is sent with
`Cache-Control: no-store`. This endpoint never writes: it takes no row lock and
changes no slot, booking, or professional.

### Time zone

A slot stores a calendar date and wall-clock start and end times. Before this
issue nothing stored which time zone they are local to, so the instant a slot
starts could only be guessed from the server. Migration
`1794200000000-ProfessionalAvailabilityTimeZone` adds
`professional_availabilities.time_zone`:

- It is `NOT NULL`, so a slot can never have an unknown zone.
- A check constraint accepts only an IANA area/location name that PostgreSQL
  resolves, such as `Africa/Lagos` or `America/New_York`. Abbreviations
  (`WAT`), fixed offsets (`UTC+1`), and unknown names are refused.
- **Existing slots.** The slot write contract has never carried a zone, so
  every stored slot was written as a local time in the platform scheduling
  time zone, `Africa/Lagos` (`PLATFORM_SCHEDULING_TIME_ZONE`). The migration
  records that zone on them. This is a statement about legacy data and is the
  decision a reviewer of the migration approves.
- **New slots.** The write contract is unchanged, so `ProfessionalService`
  records the same zone, and the column default gives it to any row written
  without one. Supporting another zone means adding it to the write contract;
  the public contract already reports the zone per slot.

Every published slot carries `time_zone`, its local `date`, `start_time`, and
`end_time`, and the same period as the UTC instants `starts_at` and `ends_at`.
The instants are computed by PostgreSQL from the stored zone
(`(date + start_time) AT TIME ZONE time_zone`), including daylight saving
rules. The zone of the API server, of the database session, and of the caller
take no part; the PostgreSQL suite reads the same slots with the server and
the session in other zones and gets the same response.

`end_time` that is not after `start_time` is on the following day, so a slot
from `23:30` to `00:15` ends 45 minutes after it starts. A slot whose end
equals its start offers no time and is not published.

### Which slots are returned

A slot is returned only when all of these hold at `as_of`:

- it belongs to the requested professional, who is publicly visible;
- its local `date` is inside `from`–`to`, both inclusive;
- `starts_at` is after `as_of`; a slot is no longer listed from the instant it
  starts;
- its stored `is_available` flag is true;
- no booking that is not `cancelled` occupies it. A booking occupies a slot
  when it names the slot (`bookings.availability_id`), or when it is for the
  same professional, date, and start time. The second form covers bookings
  stored before slots were linked, which name no slot. `pending`, `confirmed`,
  and `completed` bookings all occupy; a cancelled or rejected booking frees
  the slot again.

The professional's own `is_available` flag ("accepting consultations") does
not hide slots, because booking creation does not read it either.

### Range, order, and bound

- `from` and `to` are required calendar dates compared with the slot's local
  `date`. They are not instants and have no zone of their own.
- A range must be well formed, not reversed, and at most 31 days long. These
  are checked by request validation.
- A range whose last day has already ended in every time zone is refused with
  a 400 (`to must not be a date that has already passed`). The rule compares
  instants: a day is over everywhere once it has ended twelve hours behind
  UTC. It is deliberately not "before today on the server" or "before today in
  Lagos", either of which would refuse a range that still holds a future slot
  in a zone further west. A range that began in the past is accepted and
  returns only its future slots.
- The past-range rule runs before the professional is read, so its outcome is
  the same for a visible, hidden, or missing professional.
- Slots are ordered by `starts_at` and then by `id`, grouped under their local
  `date`. A day without open slots is absent. The same request at the same
  instant over the same stored rows returns the same response.
- One response returns at most 500 slots. When the range holds more,
  `has_more` is true and the earliest 500 are returned; requesting a range
  that starts on the last returned `date` reads the rest.
- Unknown parameters, including `time_zone`, `limit`, and `is_available`, are
  rejected with a 400.

### Non-enumeration

A professional who is missing, inactive, pending, rejected, owned by a
suspended, deactivated, or unverified account, or in an inactive speciality
produces the same 404 as the professional detail, and so does a malformed
identifier, which runs no query. A hidden professional and a missing one run
the same single statement; no slot is read for either. A request whose
identifier is malformed and whose range is also invalid receives one of the
two refusals; neither depends on stored data.

### Query shape and indexes

A visible professional costs two statements whatever the number of slots and
bookings: the visibility check, and one slot statement. Occupancy is two
`NOT EXISTS` anti-joins inside that statement; no query runs per slot.

| Predicate                                      | Index                                                             |
| ---------------------------------------------- | ----------------------------------------------------------------- |
| Professional and date range of the slots       | `professional_availabilities (professional_id, date, start_time)` |
| A booking that names the slot                  | `bookings (availability_id)` (unique)                             |
| A booking of the same professional, date, time | `bookings (professional_id, booking_date, booking_time)`          |

These indexes already existed, so none is added. The PostgreSQL suite reads a
professional's week among twenty thousand slots and bookings of someone else
and asserts that only that professional's slots in the range are touched, and
that every predicate has an index access path. The slot statement selects only
the published columns and no booking column.

### Not changed here

Slot reservation, booking creation, payment, schedule editing, reminders, and
calendar synchronization are out of scope. The authenticated
`POST /professionals/me/availabilities` and `POST /professionals/:id/availabilities`
responses now also report the stored `time_zone`.

## Deferred to later issues

- Rate controls and indexes for the public surface are delivered and verified
  in #146. Until then the public catalogue and directory rely on their bounded
  page size and two-query cost, and availability on its bounded range, slot
  count, and two-statement cost. The directory's name search and
  non-speciality sorts scan the visible set; #146 owns the index decision.
- Compatibility aliases are not provided; no existing consumer depends on a
  public discovery route.

## Verification

```bash
npx jest src/modules/public-discovery src/modules/speciality \
  src/modules/professional/public-professional src/openapi
npx jest --config ./test/jest-e2e.json --runInBand \
  test/public-discovery-boundary.e2e-spec.ts \
  test/public-speciality-catalogue.e2e-spec.ts \
  test/public-professional-directory.e2e-spec.ts \
  test/public-professional-details.e2e-spec.ts \
  test/public-professional-availability.e2e-spec.ts
PG_INTEGRATION_URL=postgres://postgres:postgres@localhost:5432/ohealth_ci \
  npx jest --runInBand \
  src/database/tests/public-discovery-visibility.integration.spec.ts \
  src/database/tests/public-speciality-catalogue.integration.spec.ts \
  src/database/tests/public-professional-directory.integration.spec.ts \
  src/database/tests/public-professional-details.integration.spec.ts \
  src/database/tests/professional-availability-time-zone-migration.integration.spec.ts \
  src/database/tests/public-professional-availability.integration.spec.ts
npm run contract:check && npm run api-client:test
```
