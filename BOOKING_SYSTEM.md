# Booking System Documentation

## Overview

The booking system lets patients discover healthcare professionals by speciality,
view their availability, and book a consultation (chat or video). Specialities and
professional profiles are managed by admins via protected write endpoints.

---

## Database Schema

### Tables

| Table | Purpose |
|-------|---------|
| `specialities` | Medical specialities (General Doctor, Nurse, …) |
| `professionals` | Healthcare professional profiles linked to user accounts |
| `professional_availabilities` | Time slots a professional has set as available |
| `bookings` | Patient consultation booking records |
| `professional_reviews` | Patient reviews for professionals (1–5 stars) |

### Key Constraints & Indexes

| Table | Constraint / Index | Description |
|-------|--------------------|-------------|
| `specialities` | `UQ_specialities_name` | Speciality names must be unique |
| `professionals` | `UQ_professionals_user_id` | One professional profile per user account |
| `professionals` | `IDX_professionals_speciality_id` | Fast lookup by speciality |
| `professional_availabilities` | `UQ_prof_avail_professional_date_start` | No duplicate slots per professional |
| `professional_availabilities` | `IDX_prof_avail_professional_date_start` | Fast slot lookup during booking |
| `bookings` | `IDX_bookings_professional_date_time` | Fast duplicate-booking detection |
| `bookings` | `FK_bookings_availability_id` | Links to the booked slot (nullable) |
| `professional_reviews` | `UQ_professional_reviews_booking_id` | One review per booking |
| `professional_reviews` | `IDX_professional_reviews_professional_id` | Fast aggregate queries |
| `professional_reviews` | `CHK_professional_reviews_rating` | Rating must be 1–5 |

---

## Full Booking Flow

```
Admin: POST /specialities
  ↓
Admin: POST /professionals  (user_id + speciality_id)
  ↓
Admin: POST /professionals/:id/availabilities  (bulk date/time slots)
  ↓
Patient: GET /specialities
  ↓
Patient: GET /professionals?speciality_id={id}
  ↓
Patient: GET /professionals/:id  (includes grouped availability slots)
  ↓
Patient: POST /bookings  (professional_id, date, time, consultation_type)
  — marks availability slot is_available = false (in a transaction)
  ↓
Patient: PATCH /bookings/:id/cancel
  — restores availability slot is_available = true (in a transaction)
  ↓
Patient: POST /professionals/:id/reviews  (rating 1–5, optional comment + booking_id)
```

---

## API Endpoints

### Specialities

#### `GET /specialities`
Returns all **active** specialities, ordered by name.
- Auth: Bearer token (any authenticated user)

#### `GET /specialities/:id`
Returns a single speciality (active or inactive).
- Auth: Bearer token

#### `POST /specialities` _(admin only)_
Creates a new speciality.
- Auth: Bearer token, role `ADMIN`
- Body: `{ name, description?, icon? }`
- Errors: `409` if name already exists

#### `PATCH /specialities/:id` _(admin only)_
Updates an existing speciality (all fields optional, including `is_active`).
- Auth: Bearer token, role `ADMIN`
- Errors: `404` if not found, `409` if new name conflicts

---

### Professionals

#### `GET /professionals?speciality_id={uuid}`
Returns active professionals for the given speciality, sorted by rating desc.
- Auth: Bearer token

#### `GET /professionals/:id`
Returns a professional's full profile with grouped available slots.
- Auth: Bearer token

#### `POST /professionals` _(admin only)_
Creates a professional profile linked to an existing user account.
- Auth: Bearer token, role `ADMIN`
- Body: `{ user_id, speciality_id, consultation_fee, image?, about?, years_of_experience?, consultation_type? }`
- Validation:
  - User must exist
  - User must hold one of: `DOCTOR`, `THERAPIST`, `COUNSELLOR`, `LAB_PROFESSIONAL`
  - Speciality must exist and be active
  - No existing professional profile for the same user
- Errors: `400`, `404`, `409`

#### `PATCH /professionals/:id` _(admin only)_
Updates a professional profile. `user_id` and `speciality_id` cannot be changed after creation.
- Auth: Bearer token, role `ADMIN`

#### `POST /professionals/:id/availabilities` _(admin only)_
Bulk-creates availability slots for a professional.
- Auth: Bearer token, role `ADMIN`
- Body: `{ slots: [{ date: "YYYY-MM-DD", start_time: "HH:MM", end_time: "HH:MM" }] }`
- Errors: `409` if any slot conflicts with an existing record (unique per professional/date/start_time)

#### `GET /professionals/:id/reviews`
Returns all reviews for a professional, newest first.
- Auth: Bearer token

#### `POST /professionals/:id/reviews`
Submits a star rating review. If `booking_id` is provided, the booking must belong to
the caller and reference the same professional. Only one review is allowed per booking.
- Auth: Bearer token (any authenticated user)
- Body: `{ rating: 1–5, comment?, booking_id? }`
- Side effect: updates denormalized `rating` and `total_reviews` on the professional record
- Errors: `400`, `404`, `409`

---

### Bookings

#### `POST /bookings`
Creates a new booking and atomically marks the availability slot as unavailable.
- Auth: Bearer token (patient)
- Body:
  ```json
  {
    "professional_id": "uuid",
    "booking_date": "YYYY-MM-DD",
    "booking_time": "HH:MM",
    "consultation_type": "chat | video",
    "notes": "optional"
  }
  ```
- Validation:
  - `booking_date` must not be in the past
  - `booking_time` must match `HH:MM`
  - Professional must exist and be active
  - Professional must support the requested `consultation_type`
  - Matching availability slot must exist and be `is_available = true`
  - No existing `PENDING` or `CONFIRMED` booking for the same professional/date/time
- The slot is locked with a pessimistic write lock inside a transaction to prevent race conditions.

#### `GET /bookings`
Returns all bookings for the authenticated user, newest first.
- Response includes: professional name, image, speciality id/name, payment_status.

#### `GET /bookings/:id`
Returns a single booking (must belong to the authenticated user).

#### `PATCH /bookings/:id/cancel`
Cancels a `PENDING` or `CONFIRMED` booking. Restores the linked availability slot
to `is_available = true` inside a transaction. Cannot cancel a `COMPLETED` booking.

---

## Booking Response Shape

```json
{
  "id": "uuid",
  "patient_id": "uuid",
  "professional_id": "uuid",
  "professional_name": "Dr. Aisha Bello",
  "professional_image": "https://...",
  "speciality_id": "uuid",
  "speciality_name": "General Doctor",
  "booking_date": "2026-07-15",
  "booking_time": "09:00",
  "consultation_type": "video",
  "amount": 5000,
  "status": "pending",
  "payment_status": "unpaid",
  "notes": null,
  "is_paid": false,
  "created_at": "2026-06-11T10:00:00Z"
}
```

---

## Booking Status Flow

```
PENDING → CONFIRMED → COMPLETED
   ↓
CANCELLED
```

---

## Running Migrations

```bash
# Apply all pending migrations
npm run migration:run

# Revert last migration
npm run migration:revert

# Show migration status
npm run migration:show
```

The latest migration is `1770900000000-BookingSystemEnhancements`.

---

## Access Control Summary

| Endpoint | Minimum role |
|----------|-------------|
| `GET /specialities` | Any authenticated user |
| `GET /specialities/:id` | Any authenticated user |
| `POST /specialities` | `ADMIN` |
| `PATCH /specialities/:id` | `ADMIN` |
| `GET /professionals` | Any authenticated user |
| `GET /professionals/:id` | Any authenticated user |
| `GET /professionals/:id/reviews` | Any authenticated user |
| `POST /professionals` | `ADMIN` |
| `PATCH /professionals/:id` | `ADMIN` |
| `POST /professionals/:id/availabilities` | `ADMIN` |
| `POST /professionals/:id/reviews` | Any authenticated user |
| `POST /bookings` | Any authenticated user (own bookings) |
| `GET /bookings` | Any authenticated user (own bookings) |
| `GET /bookings/:id` | Any authenticated user (own booking) |
| `PATCH /bookings/:id/cancel` | Any authenticated user (own booking) |

---

## Local Seed Data

The booking-flow seed populates all data needed for a patient to complete the
full consultation-booking journey in the mobile app without manually creating
any records.

### Run the seed

```bash
# 1. Make sure the database is running
docker compose up -d db

# 2. Apply all pending migrations
npm run migration:run

# 3. Seed booking-flow data
npm run seed:booking
```

The seed is **idempotent** — safe to run multiple times. Existing records are
detected and reused; no duplicates are created.

### Demo patient credentials

```
email:    patient.demo@healthbridge.test
password: Password123!
```

### Seeded data

| Category | Count |
|----------|-------|
| Specialities | 4 |
| Professional users | 9 |
| Professional profiles | 9 |
| Availability slots | 180 (9 professionals × 5 dates × 4 time slots) |
| Reviewer users | 3 |
| Reviews | 19 |

**Specialities:** General Doctor, Nurse, Nutritionist, Counsellor

**Professionals per speciality:**
- General Doctor — Dr. Adebayo Okafor (`both`), Dr. Aisha Bello (`video`), Dr. Chisom Obi (`chat`)
- Nurse — Fatima Bello (`both`), Daniel Mensah (`chat`)
- Nutritionist — Dr. Ngozi Eze (`both`), Maya Okonkwo (`video`)
- Counsellor — Dr. Emeka Nwosu (`both`), Tola Adeyemi (`chat`)

**Availability slots:** 4 time slots (09:00, 10:30, 13:00, 15:00) across 5
future dates (tomorrow through tomorrow+6) for every professional.

### Environment guard

The seed refuses to run when `NODE_ENV=production` unless
`ALLOW_PRODUCTION_SEED=true` is explicitly set.

---

## Remaining TODOs

- **Payment integration** — `is_paid` and `payment_reference` are on the `Booking` entity
  but no payment gateway is wired. A webhook handler should flip `is_paid = true` and
  update `status = CONFIRMED` after a successful charge.
- **Availability management** — no endpoint to deactivate or delete a specific slot. Add
  `PATCH /professionals/:id/availabilities/:slotId` (admin) to toggle or remove individual slots.
- **Speciality_id query validation** — `GET /professionals` does not validate that
  `speciality_id` is a valid UUID; add a `ParseUUIDPipe` on the query param.
- **Notifications** — send confirmation and reminder emails after booking creation and
  status changes.
- **Professional self-management** — currently only admins manage profiles and availability.
  A future scope would let the professional manage their own availability slots.
- **Review eligibility** — optionally restrict `POST /professionals/:id/reviews` to patients
  who have a `COMPLETED` booking with that professional.
- **Pagination** — `GET /professionals`, `GET /bookings`, and `GET /professionals/:id/reviews`
  return unbounded lists. Add limit/offset or cursor pagination before production.
