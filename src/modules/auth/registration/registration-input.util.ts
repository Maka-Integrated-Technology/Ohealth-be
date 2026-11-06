import { BadRequestException } from '@nestjs/common';

import { UserPersonaType } from '../../identity/enums/user-persona-type.enum';
import { OrganizationType } from '../../organization/enums/organization-type.enum';
import { RegisterAccountDto } from '../contracts/register-account.dto';
import { SignupIntent } from '../enums/signup-intent.enum';
import { SIGNUP_INTENT_DEFINITIONS } from '../signup-intent.policy';

export interface IRegistrationLegalVersions {
  terms: string;
  privacy: string;
}

export interface INormalizedRegistration {
  email: string;
  firstName: string;
  lastName: string;
  intent: SignupIntent;
  personaType: UserPersonaType | null;
  acceptedTermsVersion: string;
  acceptedPrivacyVersion: string;
  organization?: {
    type: OrganizationType;
    name: string;
    registrationNumber: string;
    location: string;
    contactEmail: string;
    contactPhone: string | null;
  };
}

/** Convert the public intent into non-privileged onboarding state. */
export function normalizeRegistrationInput(
  dto: RegisterAccountDto,
  legalVersions: IRegistrationLegalVersions,
): INormalizedRegistration {
  const terms = legalVersions.terms.trim();
  const privacy = legalVersions.privacy.trim();
  if (!terms || !privacy) {
    throw new Error('Registration legal version configuration is missing.');
  }
  if (
    dto.accepted_terms_version !== terms ||
    dto.accepted_privacy_version !== privacy
  ) {
    throw new BadRequestException('Current legal documents must be accepted.');
  }

  const definition = SIGNUP_INTENT_DEFINITIONS[dto.intent];
  if (!definition) {
    throw new BadRequestException('Invalid registration intent.');
  }
  const requiredText = (value: string, field: string): string => {
    const normalized = value.trim().normalize('NFC');
    if (!normalized) throw new BadRequestException(`${field} is required.`);
    return normalized;
  };
  const common = {
    email: dto.email.trim().normalize('NFC').toLowerCase(),
    firstName: requiredText(dto.first_name, 'First name'),
    lastName: requiredText(dto.last_name, 'Last name'),
    intent: dto.intent,
    personaType: definition.personaType,
    acceptedTermsVersion: terms,
    acceptedPrivacyVersion: privacy,
  };

  if (!definition.organizationType) return common;
  if (!dto.organization) {
    throw new BadRequestException('Organization details are required.');
  }
  return {
    ...common,
    organization: {
      type: definition.organizationType,
      name: requiredText(dto.organization.name, 'Organization name'),
      registrationNumber: requiredText(
        dto.organization.registration_number,
        'Organization registration number',
      ).toUpperCase(),
      location: requiredText(
        dto.organization.location,
        'Organization location',
      ),
      contactEmail: dto.organization.contact_email
        .trim()
        .normalize('NFC')
        .toLowerCase(),
      contactPhone:
        dto.organization.contact_phone?.trim().normalize('NFC') || null,
    },
  };
}

export function maskRegistrationEmail(email: string): string {
  const separator = email.lastIndexOf('@');
  if (separator < 1 || separator === email.length - 1) {
    throw new Error('Cannot mask an invalid registration address.');
  }
  return email.slice(0, 1) + '***' + email.slice(separator);
}
