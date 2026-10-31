import { BadRequestException } from '@nestjs/common';

import { UpdatePatientPersonalProfileDto } from './patient-personal-profile.dto';
import { normalizePatientPersonalUpdate } from './patient-personal-profile.util';

describe('patient personal-profile patch boundary', () => {
  it('normalizes only approved identity-neutral personal fields', () => {
    const result = normalizePatientPersonalUpdate({
      first_name: ' Ada ',
      last_name: ' Okafor ',
      address: ' 12 Example Road ',
      middle_name: '',
      dob: '2000-01-15',
    });
    expect(result).toEqual({
      first_name: 'Ada',
      last_name: 'Okafor',
      middle_name: null,
      dob: '2000-01-15',
      address: '12 Example Road',
    });
  });

  it.each([
    'email',
    'phone',
    'password',
    'image',
    'role',
    'medical_conditions',
    'user_id',
    'account_status',
  ])('rejects client-controlled %s', (field) => {
    const dto = { [field]: 'malicious' } as UpdatePatientPersonalProfileDto;
    expect(() => normalizePatientPersonalUpdate(dto)).toThrow(
      BadRequestException,
    );
  });

  it('rejects malformed and future dates and empty required names', () => {
    for (const dob of ['2026-02-30', '2100-01-01', 'not a date']) {
      expect(() => normalizePatientPersonalUpdate({ dob })).toThrow(
        BadRequestException,
      );
    }
    expect(() => normalizePatientPersonalUpdate({ first_name: '   ' })).toThrow(
      BadRequestException,
    );
  });

  it('rejects oversized addresses', () => {
    expect(() =>
      normalizePatientPersonalUpdate({ address: 'x'.repeat(501) }),
    ).toThrow(BadRequestException);
  });

  it('supports idempotent empty updates and explicit removal of optional fields', () => {
    expect(normalizePatientPersonalUpdate({})).toEqual({});
    expect(
      normalizePatientPersonalUpdate({ address: null, dob: null }),
    ).toEqual({
      address: null,
      dob: null,
    });
  });
});
