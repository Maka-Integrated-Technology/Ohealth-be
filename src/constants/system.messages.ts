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
export const UNAUTHORIZED = 'unauthorized';
export const PERMISSION_DENIED = 'permission denied';
export const VALIDATION_ERROR = 'validation error';
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
