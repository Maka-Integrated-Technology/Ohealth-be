import { BadRequestException } from '@nestjs/common';

import { UserPersonaType } from '../../identity/enums/user-persona-type.enum';
import { OrganizationType } from '../../organization/enums/organization-type.enum';
import { SignupIntent } from '../enums/signup-intent.enum';

import {
  maskRegistrationEmail,
  normalizeRegistrationInput,
} from './registration-input.util';

describe('registration input normalization', () => {
  const legal = { terms: 'terms-v1', privacy: 'privacy-v1' };

  it('normalizes a patient registration without accepting persisted roles', () => {
    expect(
      normalizeRegistrationInput(
        {
          first_name: '  Ada  ',
          last_name: ' Okafor ',
          email: ' ADA@Example.COM ',
          password: 'a memorable patient passphrase',
          intent: SignupIntent.PATIENT,
          accepted_terms_version: 'terms-v1',
          accepted_privacy_version: 'privacy-v1',
        },
        legal,
      ),
    ).toMatchObject({
      email: 'ada@example.com',
      firstName: 'Ada',
      lastName: 'Okafor',
      personaType: UserPersonaType.PATIENT,
    });
  });

  it.each([
    [SignupIntent.PHARMACY, OrganizationType.PHARMACY],
    [SignupIntent.LABORATORY, OrganizationType.LABORATORY],
    [SignupIntent.HOSPITAL, OrganizationType.HOSPITAL],
  ])('maps %s to the controlled organization type', (intent, type) => {
    const normalized = normalizeRegistrationInput(
      {
        first_name: 'Ada',
        last_name: 'Okafor',
        email: 'owner@example.com',
        password: 'a memorable owner passphrase',
        intent,
        accepted_terms_version: 'terms-v1',
        accepted_privacy_version: 'privacy-v1',
        organization: {
          name: '  OHealth Centre ',
          registration_number: ' rc-001 ',
          location: ' Lagos ',
          contact_email: ' CONTACT@EXAMPLE.COM ',
        },
      },
      legal,
    );
    expect(normalized.organization).toEqual({
      type,
      name: 'OHealth Centre',
      registrationNumber: 'RC-001',
      location: 'Lagos',
      contactEmail: 'contact@example.com',
      contactPhone: null,
    });
  });

  it('maps professional registration to the professional persona', () => {
    const normalized = normalizeRegistrationInput(
      {
        first_name: 'Ada',
        last_name: 'Okafor',
        email: 'professional@example.com',
        password: 'a memorable professional passphrase',
        intent: SignupIntent.HEALTHCARE_PROFESSIONAL,
        accepted_terms_version: 'terms-v1',
        accepted_privacy_version: 'privacy-v1',
      },
      legal,
    );
    expect(normalized.personaType).toBe(
      UserPersonaType.HEALTHCARE_PROFESSIONAL,
    );
  });

  it('rejects stale legal versions and missing organization details', () => {
    const base = {
      first_name: 'Ada',
      last_name: 'Okafor',
      email: 'owner@example.com',
      password: 'a memorable owner passphrase',
      intent: SignupIntent.HOSPITAL,
      accepted_terms_version: 'terms-v1',
      accepted_privacy_version: 'privacy-v1',
    };
    expect(() =>
      normalizeRegistrationInput(
        { ...base, accepted_terms_version: 'old' },
        legal,
      ),
    ).toThrow(BadRequestException);
    expect(() => normalizeRegistrationInput(base, legal)).toThrow(
      BadRequestException,
    );
  });

  it('rejects values that become empty after canonical trimming', () => {
    expect(() =>
      normalizeRegistrationInput(
        {
          first_name: '   ',
          last_name: 'Okafor',
          email: 'ada@example.com',
          password: 'a memorable patient passphrase',
          intent: SignupIntent.PATIENT,
          accepted_terms_version: 'terms-v1',
          accepted_privacy_version: 'privacy-v1',
        },
        legal,
      ),
    ).toThrow(BadRequestException);
  });

  it('masks all but the first address character', () => {
    expect(maskRegistrationEmail('ada@example.com')).toBe('a***@example.com');
  });
});
