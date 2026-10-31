import { BadRequestException } from '@nestjs/common';

import { OrganizationType } from '../../organization/enums/organization-type.enum';
import { RegisterAccountDto } from '../contracts/register-account.dto';
import { SignupIntent } from '../enums/signup-intent.enum';

import {
  maskRegistrationEmail,
  normalizeRegistrationInput,
} from './registration-input.util';

const legal = { terms: 'terms-v3', privacy: 'privacy-v4' };
const registration: RegisterAccountDto = {
  first_name: '  Ada ',
  last_name: ' Okafor ',
  email: ' ADA@Example.COM ',
  password: 'a long unique passphrase',
  intent: SignupIntent.PATIENT,
  accepted_terms_version: legal.terms,
  accepted_privacy_version: legal.privacy,
};

describe('intent registration input boundary', () => {
  it('normalizes patient data and never produces a platform role', () => {
    expect(normalizeRegistrationInput(registration, legal)).toEqual({
      email: 'ada@example.com',
      firstName: 'Ada',
      lastName: 'Okafor',
      intent: SignupIntent.PATIENT,
      persona: 'patient',
      acceptedTermsVersion: legal.terms,
      acceptedPrivacyVersion: legal.privacy,
    });
  });

  it('recognizes professional intent without granting a role', () => {
    const result = normalizeRegistrationInput(
      { ...registration, intent: SignupIntent.HEALTHCARE_PROFESSIONAL },
      legal,
    );
    expect(result.persona).toBe('healthcare_professional');
    expect(result).not.toHaveProperty('role');
  });

  it('normalizes organization details for each permitted organization kind', () => {
    for (const type of Object.values(OrganizationType)) {
      const result = normalizeRegistrationInput(
        {
          ...registration,
          intent: SignupIntent.ORGANIZATION,
          organization: {
            organization_type: type,
            name: ' Clinic ',
            registration_number: ' RC-100 ',
            location: ' Lagos ',
            contact_email: ' CONTACT@EXAMPLE.COM ',
          },
        },
        legal,
      );
      expect(result.persona).toBeNull();
      expect(result.organization).toMatchObject({
        type,
        name: 'Clinic',
        registrationNumber: 'RC-100',
        contactEmail: 'contact@example.com',
      });
    }
  });

  it('rejects role elevation and unexpected public claims', () => {
    expect(() =>
      normalizeRegistrationInput(
        { ...registration, role: ['ADMIN'] } as unknown as RegisterAccountDto,
        legal,
      ),
    ).toThrow(BadRequestException);
  });

  it('rejects organization data with a patient or professional intent', () => {
    expect(() =>
      normalizeRegistrationInput(
        {
          ...registration,
          organization: {
            organization_type: OrganizationType.PHARMACY,
            name: 'Shop',
            registration_number: '1',
            location: 'Abuja',
            contact_email: 'shop@example.com',
          },
        },
        legal,
      ),
    ).toThrow(BadRequestException);
  });

  it('requires the configured current legal versions', () => {
    expect(() =>
      normalizeRegistrationInput(
        { ...registration, accepted_privacy_version: 'outdated' },
        legal,
      ),
    ).toThrow(BadRequestException);
    expect(() =>
      normalizeRegistrationInput(registration, { terms: '', privacy: '' }),
    ).toThrow('Registration legal version configuration is missing.');
  });

  it('masks email before it is returned to the client', () => {
    expect(maskRegistrationEmail('ada@example.com')).toBe('a***@example.com');
    expect(() => maskRegistrationEmail('invalid')).toThrow();
  });
});
