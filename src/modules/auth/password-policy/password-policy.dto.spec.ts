import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { LaboratoryAdministratorSetupDto } from '../../laboratory/dto/laboratory-admin-setup.dto';
import { AcceptLaboratoryStaffInvitationDto } from '../../laboratory/dto/laboratory-post-approval.dto';
import { OrganizationAdministratorDto } from '../../organization/dto/organization-setup.dto';
import { UserRole } from '../../user/enums/user-role.enum';
import { RegisterAccountDto } from '../contracts/register-account.dto';
import { AuthDto, ChangePasswordDto, ResetPasswordDto } from '../dto/auth.dto';
import { SignupIntent } from '../enums/signup-intent.enum';

describe('One password policy across all account intents', () => {
  const testCases = [
    {
      type: AuthDto,
      field: 'password',
      base: {
        first_name: 'Ada',
        last_name: 'Okafor',
        email: 'ada@example.com',
        role: [UserRole.PATIENT],
      },
    },
    {
      type: RegisterAccountDto,
      field: 'password',
      base: {
        first_name: 'Ada',
        last_name: 'Okafor',
        email: 'ada@example.com',
        intent: SignupIntent.PATIENT,
        accepted_terms_version: 'v1',
        accepted_privacy_version: 'v1',
      },
    },
    { type: ResetPasswordDto, field: 'newPassword', base: { token: 'token' } },
    {
      type: ChangePasswordDto,
      field: 'newPassword',
      base: { currentPassword: 'OldPass123' },
    },
    {
      type: LaboratoryAdministratorSetupDto,
      field: 'password',
      base: {
        full_name: 'Ada Okafor',
        email: 'ada@example.com',
        phone: '+2348012345678',
      },
    },
    {
      type: OrganizationAdministratorDto,
      field: 'password',
      base: {
        full_name: 'Ada Okafor',
        email: 'ada@example.com',
        phone: '+2348012345678',
      },
    },
    {
      type: AcceptLaboratoryStaffInvitationDto,
      field: 'password',
      base: { token: 'a'.repeat(64) },
    },
  ] as const;

  it.each(testCases)(
    'accepts a compliant password in $type.name',
    async ({ type, field, base }) => {
      const dto = plainToInstance(type as new () => object, {
        ...base,
        [field]: 'a memorable patient passphrase',
      });
      const errors = await validate(dto);
      expect(errors.find((x) => x.property === field)).toBeUndefined();
    },
  );

  it.each(testCases)(
    'rejects weak and pathological values in $type.name',
    async ({ type, field, base }) => {
      for (const value of [
        'Password1',
        'short phrase',
        'password123456789',
        'A'.repeat(1025),
      ]) {
        const dto = plainToInstance(type as new () => object, {
          ...base,
          [field]: value,
        });
        const errors = await validate(dto);
        expect(errors.some((x) => x.property === field)).toBe(true);
      }
    },
  );
});
