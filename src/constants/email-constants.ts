/**
 * Defines the filenames for email templates.
 * This ensures we use constants instead of magic strings.
 */
export enum EmailTemplateID {
  WELCOME = 'welcome.njk',
  VERIFICATION_CODE = 'verification-code.njk',
  OTP = 'otp.njk',
}
