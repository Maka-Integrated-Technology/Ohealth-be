import { COMPROMISED_PASSWORDS } from './compromised-passwords.generated';

/** Shared setting policy for single-factor credentials (NIST SP 800-63B). */
export const PASSWORD_MIN_LENGTH = 15;
export const PASSWORD_MAX_UTF8_BYTES = 1024;
export const LOGIN_PASSWORD_MAX_UTF8_BYTES = 1024;
export const PASSWORD_POLICY_MESSAGE =
  'Password must contain at least 15 Unicode characters, use no more than 1024 UTF-8 bytes, and not appear on the compromised-password blocklist.';

// Committed, pinned NCSC-derived whole-password corpus plus reviewed local entries.
const BLOCKED_PASSWORDS = new Set<string>(COMPROMISED_PASSWORDS);

// Bound input size before Unicode normalization to limit pathological requests.
// NFC-equivalent modern passwords are checked against their normalized byte length.
export const LOGIN_PASSWORD_MAX_RAW_UTF8_BYTES = 8192;
export function isLoginPasswordWithinLimit(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    Buffer.byteLength(value, 'utf8') <= LOGIN_PASSWORD_MAX_RAW_UTF8_BYTES &&
    Buffer.byteLength(value.normalize('NFC'), 'utf8') <=
      LOGIN_PASSWORD_MAX_UTF8_BYTES
  );
}

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
