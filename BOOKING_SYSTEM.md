# Booking System Documentation

## Overview
This booking system allows patients to book consultations with healthcare professionals (doctors, nurses, nutritionists, counselors).

## Database Schema

### Tables Created
1. **specialities** - Medical specialities (General Doctor, Nurse, etc.)
2. **professionals** - Healthcare professionals with their details
3. **professional_availabilities** - Available time slots for professionals
4. **bookings** - Patient booking records

## API Endpoints

### 1. Get All Specialities
```
GET /specialities
Authorization: Bearer {token}
```
Returns list of all active specialities.

### 2. Get Professionals by Speciality
```
GET /professionals?speciality_id={uuid}
Authorization: Bearer {token}
```
Returns professionals filtered by speciality with:
- Name, image, rating, reviews
- Consultation fee, years of experience
- Consultation type (chat/video/both)

### 3. Get Professional Details
```
GET /professionals/{id}
Authorization: Bearer {token}
```
Returns detailed professional profile with:
- All basic information
- Grouped availabilities by date with time slots

### 4. Create Booking
```
POST /bookings
Authorization: Bearer {token}
Content-Type: application/json

{
  "professional_id": "uuid",
  "booking_date": "2024-02-10",
  "booking_time": "10:00",
  "consultation_type": "video",
  "notes": "Optional notes"
}
```

### 5. Get User Bookings
```
GET /bookings
Authorization: Bearer {token}
```
Returns all bookings for the authenticated user.

### 6. Get Booking Details
```
GET /bookings/{id}
Authorization: Bearer {token}
```

### 7. Cancel Booking
```
PATCH /bookings/{id}/cancel
Authorization: Bearer {token}
```

## Running Migrations

```bash
# Run migrations
npm run typeorm migration:run -- -d src/database/data-source.ts

# Revert last migration
npm run typeorm migration:revert -- -d src/database/data-source.ts
```

## Booking Flow

1. **Select Speciality** → GET /specialities
2. **View Professionals** → GET /professionals?speciality_id={id}
3. **View Professional Profile** → GET /professionals/{id}
4. **Create Booking** → POST /bookings
5. **Payment** (To be implemented)
6. **View Bookings** → GET /bookings

## Validation Rules

- Professional must exist and be active
- Professional must support the requested consultation type
- Time slot must be available
- No duplicate bookings for same time slot
- Only pending/confirmed bookings can be cancelled

## Status Flow

```
PENDING → CONFIRMED → COMPLETED
   ↓
CANCELLED
```

## Next Steps (Payment Integration)

1. Add payment gateway integration (Stripe/Paystack)
2. Update booking status after successful payment
3. Send confirmation emails/notifications
4. Add webhook handlers for payment callbacks
