/** Shared password-setting policy for #76, reused by recovery (#75) and signup (#78). */
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_UTF8_BYTES = 72;
export const LOGIN_PASSWORD_MAX_UTF8_BYTES = 1024;
export const PASSWORD_POLICY_MESSAGE =
  'Password must be at least 8 characters, contain uppercase and lowercase letters and a number, and use no more than 72 UTF-8 bytes.';

export function meetsPasswordPolicy(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length >= PASSWORD_MIN_LENGTH &&
    Buffer.byteLength(value, 'utf8') <= PASSWORD_MAX_UTF8_BYTES &&
    /[a-z]/.test(value) &&
    /[A-Z]/.test(value) &&
    /[0-9]/.test(value)
  );
}
