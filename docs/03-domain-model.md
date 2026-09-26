# Identity and organization domain model

## Core relationships

```text
User
  |-- UserPersona [patient]
  |-- UserPersona [healthcare_professional]
  |-- PatientProfile
  |-- ProfessionalProfile
  |     `-- Speciality / credentials / verification
  |-- OrganizationMembership [zero or many]
  |     `-- Organization [hospital | laboratory | pharmacy]
  |-- Session [zero or many]
  |-- MfaFactor [zero or many]
  `-- LegalAcceptance [many, versioned]
```

## User

The user owns identity attributes such as normalized email, names, account
status, and verification time. Authentication credentials should be separated
from ordinary profile fields as the rework progresses.

The user does not own an organization role and should not contain speciality or
clinical data.

## Personas

Supported personas are patient and healthcare professional. Personas answer
“how does this person use OHealth?” They do not answer “what may this person do
inside an organization?”

A user can hold both personas without creating a second account.

## Healthcare professional

Counsellors, general doctors, nurses, nutritionists, therapists, laboratory
professionals, and related practitioners are healthcare professionals.

Their discipline belongs in professional profile and speciality data. License,
credential, and verification status belong to the professional profile or
credential records. Speciality labels never grant administrative permissions.

The current professional table has one speciality reference. The target model
may introduce a professional-speciality junction when multiple verified
specialities are required.

## Patient

Patient profile data is separate from identity. Clinical information is subject
to stricter access, auditing, retention, and disclosure rules than basic account
data.

A professional must not receive patient access solely because they hold a
professional persona. Access must follow a booking, care relationship,
organization assignment, consent, or another explicit server-side policy.

## Organization

Supported organization types are:

- hospital;
- laboratory;
- pharmacy.

An organization owns its operational configuration, locations, verification,
documents, services, and staff relationships. It never owns the human user row.

## Organization membership

A membership connects one user to one organization.

Initial roles:

- `owner` — governance and full organization administration;
- `admin` — delegated organization administration;
- `member` — ordinary organization access, refined by permissions and resource
  assignments.

Membership status is independent of the user’s global account status:

- `invited`
- `active`
- `suspended`
- `removed`

A user may be an owner in one organization and a member in another. Removing one
membership does not delete the user or their other memberships.

## Platform privileges

Platform privileges are reserved for OHealth internal operations and must be
modelled separately from organization membership and personas. They are never
available through public signup or ordinary organization administration.

## Legal acceptance

Terms and privacy-policy acceptance records include the user, document type,
document version, acceptance time, and safe request metadata. A boolean on the
signup request is not sufficient evidence by itself.

## Data invariants

- Email uniqueness is based on normalized email.
- A user has at most one active persona row of each type.
- A user has at most one membership per organization.
- An organization has at least one owner before becoming operational.
- Organization roles never imply a professional speciality.
- Profile deletion and identity deletion follow explicit retention policy.
