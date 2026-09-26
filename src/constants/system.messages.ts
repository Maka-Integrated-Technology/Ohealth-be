// Authentication
export const ACCOUNT_CREATED = 'account created';
export const ACCOUNT_ALREADY_EXISTS = 'account already exists';
export const ACTIVATE_ACCOUNT = 'activate account';
export const LOGIN_SUCCESS = 'login success';
export const LOGIN_FAILED = 'login failed';
export const INVALID_CREDENTIALS = 'invalid credentials';
export const TOKEN_EXPIRED = 'token expired';
export const TOKEN_INVALID = 'token invalid';
export const TOKEN_REFRESH_SUCCESS = 'token refresh successful';
export const LOGOUT_SUCCESS = 'logout success';
export const USER_INACTIVE = 'user account is inactive';
export const USER_NOT_FOUND = 'user not found';
export const USER_ACTIVATED = 'user account activated';
export const USER_IS_ACTIVATED = 'user account is already active';
export const INVALID_GOOGLE_TOKEN = 'invalid google token';
export const REGISTRATION_INVITE_ONLY = 'registration is by invite only';
export const INVALID_VERIFICATION_TOKEN = 'invalid verification token';
export const INVITE_EMAIL_MISMATCH = 'invite email does not match account';
export const PASSWORD_RESET_TOKEN_SENT = 'password reset instructions sent';
export const PASSWORD_RESET_CODE_SENT = 'password reset code sent';
export const PASSWORD_RESET_SUCCESS = 'password reset successful';
export const PROFILE_RETRIEVED = 'profile retrieved';
export const PROFILE_UPDATED = 'profile updated';
export const PASSWORD_CHANGED = 'password changed';
export const INVALID_CURRENT_PASSWORD = 'current password is incorrect';
export const UNAUTHORIZED = 'unauthorized';
export const PERMISSION_DENIED = 'permission denied';
export const VALIDATION_ERROR = 'validation error';
export const INVALID_SIGNUP_ROLE =
  'select exactly one supported role during signup';
export const LABORATORY_APPROVED_ADMIN_REQUIRED =
  'an active, approved laboratory administrator account is required';
export const LABORATORY_OPERATING_HOURS_DUPLICATE_DAY =
  'operating hours may only contain one entry per day';
export const LABORATORY_OPERATING_HOURS_INVALID =
  'open days require an opening time earlier than the closing time; closed days cannot include times';
export const LABORATORY_TEST_ALREADY_EXISTS =
  'a laboratory test with this name already exists';
export const LABORATORY_TEST_NAME_REQUIRED = 'laboratory test name is required';
export const LABORATORY_TEST_NOT_FOUND = 'laboratory test not found';
export const LABORATORY_TEST_UPDATE_REQUIRED =
  'provide at least one laboratory test field to update';
export const LABORATORY_STAFF_ALREADY_EXISTS =
  'a laboratory staff account or active invitation already exists for this email';
export const LABORATORY_STAFF_NAME_REQUIRED =
  'laboratory staff full name is required';
export const LABORATORY_STAFF_INVITATION_INVALID =
  'laboratory staff invitation is invalid or expired';
export const LABORATORY_STAFF_INVITED =
  'laboratory staff invitation sent successfully';
export const LABORATORY_STAFF_INVITATION_SEND_FAILED =
  'laboratory staff invitation could not be sent; try again';
export const LABORATORY_STAFF_INVITATION_ACCEPTED =
  'laboratory staff invitation accepted successfully';
export const ACCOUNT_CREATION_EMAIL_SENT = 'account creation email sent';
export const VERIFICATION_CODE_SENT = 'verification code sent';
export const INVALID_VERIFICATION_CODE = 'invalid verification code';
export const VERIFICATION_CODE_EXPIRED = 'verification code expired';
export const ACCOUNT_VERIFIED = 'account verified';
export const ACCOUNT_ALREADY_VERIFIED = 'account already verified';

// Booking
export const BOOKING_CREATED = 'booking created successfully';
export const BOOKING_NOT_FOUND = 'booking not found';
export const BOOKING_CANCELLED = 'booking cancelled successfully';
export const BOOKING_ALREADY_CANCELLED = 'booking already cancelled';
export const BOOKING_CANNOT_CANCEL_COMPLETED =
  'cannot cancel completed booking';
export const PROFESSIONAL_NOT_FOUND = 'professional not found';
export const CONSULTATION_TYPE_NOT_SUPPORTED =
  'professional does not support this consultation type';
export const TIME_SLOT_NOT_AVAILABLE = 'selected time slot is not available';
export const TIME_SLOT_ALREADY_BOOKED = 'time slot already booked';

// 2FA
export const MFA_SETUP_SUCCESS = '2fa setup initialized';

// Speciality
export const SPECIALITY_NOT_FOUND = 'speciality not found';
export const SPECIALITY_ALREADY_EXISTS =
  'speciality with this name already exists';
export const SPECIALITY_CREATED = 'speciality created successfully';
export const SPECIALITY_UPDATED = 'speciality updated successfully';

// Laboratory onboarding
export const LABORATORY_ADMIN_SETUP_COMPLETED =
  'laboratory administrator setup completed successfully';
export const LABORATORY_ALREADY_EXISTS =
  'laboratory with this registration or license number already exists';
export const LABORATORY_ADMIN_ALREADY_EXISTS =
  'laboratory administrator account already exists';
export const LABORATORY_ADMIN_EMAIL_ALREADY_REGISTERED =
  'this email is already registered to another account and cannot be used for a laboratory administrator';

// Pharmacy onboarding
export const PHARMACY_CREATED = 'pharmacy registration submitted successfully';
export const PHARMACY_ALREADY_EXISTS =
  'pharmacy with this registration number or license number already exists';

// Shared organization onboarding
export const ORGANIZATION_ADMIN_SETUP_COMPLETED =
  'organization administrator setup completed successfully';
export const ORGANIZATION_ALREADY_EXISTS =
  'organization with this registration number already exists';
export const ORGANIZATION_ADMIN_EMAIL_ALREADY_REGISTERED =
  'this email is already registered and cannot be used for an organization administrator';

// Professional admin
export const PROFESSIONAL_ALREADY_EXISTS =
  'professional profile already exists for this user';
export const PROFESSIONAL_CREATED = 'professional created successfully';
export const PROFESSIONAL_UPDATED = 'professional updated successfully';
export const PROFESSIONAL_INVALID_ROLE =
  'user does not have a valid professional role';
export const AVAILABILITY_CREATED = 'availability slots created successfully';

// Reviews
export const REVIEW_CREATED = 'review submitted successfully';
export const REVIEW_ALREADY_EXISTS =
  'a review has already been submitted for this booking';
export const REVIEW_INVALID_BOOKING =
  'booking does not belong to this reviewer or professional';

// Booking validation
export const BOOKING_INVALID_DATE = 'booking date cannot be in the past';
export const BOOKING_INVALID_TIME = 'booking time must be in HH:MM format';
export const PATIENT_NOT_FOUND = 'patient not found for this professional';
export const PATIENT_NOTE_NOT_FOUND = 'patient note not found';
