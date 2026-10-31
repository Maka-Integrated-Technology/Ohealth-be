import { BadRequestException } from '@nestjs/common';

import { UserPersonaType } from '../../identity/enums/user-persona-type.enum';
import { OrganizationType } from '../../organization/enums/organization-type.enum';
import { RegisterAccountDto } from '../contracts/register-account.dto';
import { SignupIntent } from '../enums/signup-intent.enum';

export interface IRegistrationLegalVersions {
  terms: string;
  privacy: string;
}

export interface INormalizedRegistration {
  email: string;
  firstName: string;
  lastName: string;
  intent: SignupIntent;
  persona: UserPersonaType | null;
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

/**
 * Converts public intent into non-privileged onboarding context. Client roles,
 * permissions, and any organization details on persona intents are rejected.
 * This is not an authorization grant.
 */
export function normalizeRegistrationInput(
  dto: RegisterAccountDto,
  legalVersions: IRegistrationLegalVersions,
): INormalizedRegistration {
  if (!legalVersions.terms?.trim() || !legalVersions.privacy?.trim()) {
    throw new Error('Registration legal version configuration is missing.');
  }
  const input = dto as unknown as Record<string, unknown>;
  const permitted = new Set([
    'first_name',
    'last_name',
    'email',
    'password',
    'intent',
    'accepted_terms_version',
    'accepted_privacy_version',
    'organization',
  ]);
  if (Object.keys(input).some((key) => !permitted.has(key))) {
    throw new BadRequestException('Unknown registration property.');
  }
  if (
    dto.accepted_terms_version !== legalVersions.terms ||
    dto.accepted_privacy_version !== legalVersions.privacy
  ) {
    throw new BadRequestException('Current legal documents must be accepted.');
  }
  if (
    !Object.values(SignupIntent).includes(dto.intent) ||
    !dto.email?.trim() ||
    !dto.first_name?.trim() ||
    !dto.last_name?.trim()
  ) {
    throw new BadRequestException('Invalid registration data.');
  }

  const common = {
    email: dto.email.trim().toLowerCase(),
    firstName: dto.first_name.trim(),
    lastName: dto.last_name.trim(),
    intent: dto.intent,
    acceptedTermsVersion: legalVersions.terms,
    acceptedPrivacyVersion: legalVersions.privacy,
  };
  if (dto.intent !== SignupIntent.ORGANIZATION) {
    if (dto.organization !== undefined) {
      throw new BadRequestException(
        'Organization details require organization intent.',
      );
    }
    return {
      ...common,
      persona:
        dto.intent === SignupIntent.PATIENT
          ? UserPersonaType.PATIENT
          : UserPersonaType.HEALTHCARE_PROFESSIONAL,
    };
  }
  const org = dto.organization;
  if (
    !org ||
    !Object.values(OrganizationType).includes(org.organization_type) ||
    !org.name?.trim() ||
    !org.registration_number?.trim() ||
    !org.location?.trim() ||
    !org.contact_email?.trim()
  ) {
    throw new BadRequestException('Valid organization details are required.');
  }
  return {
    ...common,
    persona: null,
    organization: {
      type: org.organization_type,
      name: org.name.trim(),
      registrationNumber: org.registration_number.trim(),
      location: org.location.trim(),
      contactEmail: org.contact_email.trim().toLowerCase(),
      contactPhone: org.contact_phone?.trim() || null,
    },
  };
}

export function maskRegistrationEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!local || !domain) {
    throw new Error('Cannot mask an invalid registration address.');
  }
  return local.slice(0, 1) + '***@' + domain;
}
