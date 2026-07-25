import {
  ArgumentMetadata,
  BadRequestException,
  ValidationPipe,
} from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { CreatePharmacyDto } from './create-pharmacy.dto';

describe('CreatePharmacyDto', () => {
  const validPayload = {
    name: 'HealthPlus Pharmacy',
    registration_number: 'PCN-123456',
    license_number: 'LIC-789012',
    business_address: '12 Admiralty Way, Lekki Phase 1',
    region: 'Lagos',
    contact_email: 'contact@healthplus.example',
    contact_phone: '+2348012345678',
  };

  const validatePayload = (payload: Record<string, unknown>) =>
    validate(plainToInstance(CreatePharmacyDto, payload));

  it('should accept valid pharmacy registration details', async () => {
    const errors = await validatePayload(validPayload);

    expect(errors).toHaveLength(0);
  });

  it('should trim string fields before validation', async () => {
    const dto = plainToInstance(CreatePharmacyDto, {
      name: ' HealthPlus Pharmacy ',
      registration_number: ' PCN-123456 ',
      license_number: ' LIC-789012 ',
      business_address: ' 12 Admiralty Way, Lekki Phase 1 ',
      region: ' Lagos ',
      contact_email: ' contact@healthplus.example ',
      contact_phone: ' +2348012345678 ',
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
    expect(dto).toMatchObject(validPayload);
  });

  it.each([
    'name',
    'registration_number',
    'license_number',
    'business_address',
    'region',
    'contact_email',
    'contact_phone',
  ])('should reject missing %s', async (field) => {
    const payload = { ...validPayload };
    delete payload[field as keyof typeof payload];

    const errors = await validatePayload(payload);

    expect(errors.some((error) => error.property === field)).toBe(true);
  });

  it.each([
    'name',
    'registration_number',
    'license_number',
    'business_address',
    'region',
    'contact_email',
    'contact_phone',
  ])('should reject whitespace-only %s', async (field) => {
    const errors = await validatePayload({
      ...validPayload,
      [field]: '   ',
    });

    expect(errors.some((error) => error.property === field)).toBe(true);
  });

  it.each(['not-an-email', 'contact@', '@healthplus.example'])(
    'should reject invalid contact email %s',
    async (contactEmail) => {
      const errors = await validatePayload({
        ...validPayload,
        contact_email: contactEmail,
      });

      expect(errors.some((error) => error.property === 'contact_email')).toBe(
        true,
      );
    },
  );

  it.each(['123', 'abc1234567', '+2348012345678901234567890', '(234)abc-1234'])(
    'should reject invalid contact phone %s',
    async (contactPhone) => {
      const errors = await validatePayload({
        ...validPayload,
        contact_phone: contactPhone,
      });

      expect(errors.some((error) => error.property === 'contact_phone')).toBe(
        true,
      );
    },
  );

  it('should reject non-string values for string fields', async () => {
    const errors = await validatePayload({
      ...validPayload,
      name: 12345,
    });

    expect(errors.some((error) => error.property === 'name')).toBe(true);
  });

  it('should reject unknown fields through the global validation pipe settings', async () => {
    const pipe = new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    });

    await expect(
      pipe.transform(
        {
          ...validPayload,
          unsupported_field: 'not allowed',
        },
        {
          type: 'body',
          metatype: CreatePharmacyDto,
        } as ArgumentMetadata,
      ),
    ).rejects.toThrow(BadRequestException);
  });
});
