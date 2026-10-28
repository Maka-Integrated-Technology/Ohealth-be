import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { UserRole } from '../../user/enums/user-role.enum';

import { AuthDto, ResetPasswordDto, VerifySignupDto } from './auth.dto';

describe('AuthDto', () => {
  const validPayload = {
    first_name: 'Tunde',
    last_name: 'Adebayo',
    email: 'tunde@example.com',
    password: 'a memorable patient passphrase',
    role: [UserRole.PATIENT],
  };

  it.each([
    UserRole.PATIENT,
    UserRole.DOCTOR,
    UserRole.THERAPIST,
    UserRole.COUNSELLOR,
    UserRole.LAB_PROFESSIONAL,
  ])('accepts the supported self-service role %s', async (role) => {
    const errors = await validate(
      plainToInstance(AuthDto, { ...validPayload, role: [role] }),
    );

    expect(errors).toHaveLength(0);
  });

  it.each([
    undefined,
    [],
    [UserRole.ADMIN],
    [UserRole.LAB_ADMIN],
    [UserRole.HOSPITAL_ADMIN],
    [UserRole.PHARMACY_ADMIN],
    [UserRole.PATIENT, UserRole.DOCTOR],
  ])('rejects invalid signup role selection %#', async (role) => {
    const errors = await validate(
      plainToInstance(AuthDto, { ...validPayload, role }),
    );

    expect(errors.some((error) => error.property === 'role')).toBe(true);
  });

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
