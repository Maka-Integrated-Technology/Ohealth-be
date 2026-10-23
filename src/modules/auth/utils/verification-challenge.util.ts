import { randomInt } from 'node:crypto';

/** Email ownership is not established until the recipient proves this code. */
export function generateVerificationChallenge(): {
  verification_code: string;
  verification_code_expires_at: Date;
} {
  return {
    verification_code: String(randomInt(100000, 1000000)),
    verification_code_expires_at: new Date(Date.now() + 10 * 60 * 1000),
  };
}
