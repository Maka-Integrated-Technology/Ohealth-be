import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { ResetPasswordDto, VerifySignupDto } from './auth.dto';

describe('auth challenge DTOs', () => {
  it('requires a challenge UUID and six-digit code for contact verification', async () => {
    const invalid = await validate(
      plainToInstance(VerifySignupDto, {
        email: 'ada@example.test',
        code: '123456',
      }),
    );
    expect(invalid.some((error) => error.property === 'challenge_id')).toBe(
      true,
    );
    const valid = await validate(
      plainToInstance(VerifySignupDto, {
        challenge_id: 'f64031c5-70e4-4b37-a92c-f193e59a6621',
        code: '123456',
      }),
    );
    expect(valid).toHaveLength(0);
  });

  it('rejects legacy reset tokens and requires purpose-bound challenge proof', async () => {
    const bad = await validate(
      plainToInstance(ResetPasswordDto, {
        token: 'old-plaintext-reset-token',
        newPassword: 'a memorable replacement passphrase',
      }),
    );
    expect(bad.map((x) => x.property)).toEqual(
      expect.arrayContaining(['challenge_id', 'code']),
    );
  });
});
