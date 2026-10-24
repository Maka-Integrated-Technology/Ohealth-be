/** Shared setting policy for single-factor credentials (NIST SP 800-63B). */
export const PASSWORD_MIN_LENGTH = 15;
export const PASSWORD_MAX_UTF8_BYTES = 1024;
export const LOGIN_PASSWORD_MAX_UTF8_BYTES = 1024;
export const PASSWORD_POLICY_MESSAGE =
  'Password must contain at least 15 Unicode characters, use no more than 1024 UTF-8 bytes, and not appear on the common-password blocklist.';

// Whole-password comparison only: never prohibit arbitrary character patterns.
// The seed list should be extended with a periodically updated breach corpus.
const BLOCKED_PASSWORDS = new Set([
  'password123456789',
  'password1234567890',
  'passwordpassword',
  '123456789012345',
  '12345678901234567890',
  'qwertyuiopasdfgh',
  'qwertyuiopasdfghjkl',
  'correcthorsebatterystaple',
  'letmeinletmeinletmein',
  'welcome123456789',
  'changeme123456789',
  'mypassword123456',
  'iloveyouiloveyou',
  'administrator123456',
  'securepassword123',
  'ohealthpassword123',
  'ohealth123456789',
  'ohealthohealth123',
  'password12345678',
  'thisisapassword',
  'thisismypassword',
  'trustnoone123456',
  'sunshine123456789',
]);

export function meetsPasswordPolicy(value: unknown): value is string {
  if (typeof value !== 'string') {
    return false;
  }
  const normalized = value.normalize('NFC');
  return (
    Array.from(normalized).length >= PASSWORD_MIN_LENGTH &&
    Buffer.byteLength(normalized, 'utf8') <= PASSWORD_MAX_UTF8_BYTES &&
    !BLOCKED_PASSWORDS.has(normalized.toLowerCase())
  );
}
