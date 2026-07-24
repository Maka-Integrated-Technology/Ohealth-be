import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { UserRole } from '../../user/enums/user-role.enum';

import { AuthDto } from './auth.dto';

describe('AuthDto', () => {
  const validPayload = {
    first_name: 'Tunde',
    last_name: 'Adebayo',
    email: 'tunde@example.com',
    password: 'Password123',
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
});
