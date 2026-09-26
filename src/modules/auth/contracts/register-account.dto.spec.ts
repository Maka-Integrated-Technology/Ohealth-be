import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { OrganizationType } from '../../organization/enums/organization-type.enum';
import { SignupIntent } from '../enums/signup-intent.enum';

import { RegisterAccountDto } from './register-account.dto';

const validRegistration = {
  first_name: 'Ada',
  last_name: 'Okafor',
  email: 'ada@example.com',
  password: 'a-long-passphrase',
  intent: SignupIntent.PATIENT,
  accepted_terms_version: '2026-08-01',
  accepted_privacy_version: '2026-08-01',
};

describe('RegisterAccountDto', () => {
  it('accepts patient registration without a backend role', async () => {
    const dto = plainToInstance(RegisterAccountDto, validRegistration);

    await expect(validate(dto)).resolves.toHaveLength(0);
    expect(dto).not.toHaveProperty('role');
  });

  it('requires organization details for organization registration', async () => {
    const dto = plainToInstance(RegisterAccountDto, {
      ...validRegistration,
      intent: SignupIntent.ORGANIZATION,
    });

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'organization')).toBe(
      true,
    );
  });

  it('validates nested organization details', async () => {
    const dto = plainToInstance(RegisterAccountDto, {
      ...validRegistration,
      intent: SignupIntent.ORGANIZATION,
      organization: {
        organization_type: OrganizationType.HOSPITAL,
        name: 'OHealth Medical Centre',
        registration_number: 'RC-123456',
        location: 'Lagos',
        contact_email: 'operations@example.com',
      },
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it('rejects a short password', async () => {
    const dto = plainToInstance(RegisterAccountDto, {
      ...validRegistration,
      password: 'short123',
    });

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'password')).toBe(true);
  });
});
