import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { SignupIntent } from '../enums/signup-intent.enum';

import { RegisterAccountDto } from './register-account.dto';

const validRegistration = {
  first_name: 'Ada',
  last_name: 'Okafor',
  email: 'ada@example.com',
  password: 'ALongPassphrase123',
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

  it.each([
    SignupIntent.PHARMACY,
    SignupIntent.LABORATORY,
    SignupIntent.HOSPITAL,
  ])('requires organization details for %s registration', async (intent) => {
    const dto = plainToInstance(RegisterAccountDto, {
      ...validRegistration,
      intent,
    });

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'organization')).toBe(
      true,
    );
  });

  it.each([SignupIntent.PATIENT, SignupIntent.HEALTHCARE_PROFESSIONAL])(
    'rejects organization details for %s registration',
    async (intent) => {
      const dto = plainToInstance(RegisterAccountDto, {
        ...validRegistration,
        intent,
        organization: {
          name: 'OHealth Hospital',
          registration_number: 'RC-123456',
          location: 'Lagos',
          contact_email: 'operations@example.com',
        },
      });

      const errors = await validate(dto);

      expect(errors.some((error) => error.property === 'organization')).toBe(
        true,
      );
    },
  );

  it.each([
    SignupIntent.PHARMACY,
    SignupIntent.LABORATORY,
    SignupIntent.HOSPITAL,
  ])(
    'validates nested organization details for %s registration',
    async (intent) => {
      const dto = plainToInstance(RegisterAccountDto, {
        ...validRegistration,
        intent,
        organization: {
          name: 'OHealth Diagnostics',
          registration_number: 'RC-123456',
          location: 'Lagos',
          contact_email: 'operations@example.com',
        },
      });

      await expect(validate(dto)).resolves.toHaveLength(0);
    },
  );

  it('rejects the obsolete generic organization intent', async () => {
    const dto = plainToInstance(RegisterAccountDto, {
      ...validRegistration,
      intent: 'organization',
    });

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'intent')).toBe(true);
  });

  it('rejects a client-supplied organization type', async () => {
    const dto = plainToInstance(RegisterAccountDto, {
      ...validRegistration,
      intent: SignupIntent.HOSPITAL,
      organization: {
        organization_type: 'pharmacy',
        name: 'OHealth Hospital',
        registration_number: 'RC-123456',
        location: 'Lagos',
        contact_email: 'operations@example.com',
      },
    });

    const errors = await validate(dto, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });

    expect(JSON.stringify(errors)).toContain('organization_type');
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
