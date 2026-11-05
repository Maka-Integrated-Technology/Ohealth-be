import { UserPersonaType } from '../identity/enums/user-persona-type.enum';
import { OrganizationMembershipRole } from '../organization/enums/organization-membership-role.enum';
import { OrganizationMembershipStatus } from '../organization/enums/organization-membership-status.enum';
import { OrganizationType } from '../organization/enums/organization-type.enum';
import { OrganizationVerificationStatus } from '../organization/enums/organization-verification-status.enum';
import { AccountStatus } from '../user/enums/account-status.enum';

import { SignupIntent } from './enums/signup-intent.enum';
import {
  isOrganizationSignupIntent,
  SIGNUP_INTENT_DEFINITIONS,
} from './signup-intent.policy';

describe('signup intent policy', () => {
  it('defines every and only supported public signup intent', () => {
    expect(Object.keys(SIGNUP_INTENT_DEFINITIONS).sort()).toEqual(
      Object.values(SignupIntent).sort(),
    );
    expect(Object.values(SignupIntent)).not.toContain('organization');
  });

  it.each([
    [SignupIntent.PATIENT, UserPersonaType.PATIENT],
    [
      SignupIntent.HEALTHCARE_PROFESSIONAL,
      UserPersonaType.HEALTHCARE_PROFESSIONAL,
    ],
  ])(
    'maps %s to its persona without organization authority',
    (intent, persona) => {
      const definition = SIGNUP_INTENT_DEFINITIONS[intent];

      expect(definition.personaType).toBe(persona);
      expect(definition.organizationType).toBeNull();
      expect(isOrganizationSignupIntent(intent)).toBe(false);
    },
  );

  it.each([
    [SignupIntent.PHARMACY, OrganizationType.PHARMACY],
    [SignupIntent.LABORATORY, OrganizationType.LABORATORY],
    [SignupIntent.HOSPITAL, OrganizationType.HOSPITAL],
  ])('maps %s to pending organization onboarding', (intent, type) => {
    const definition = SIGNUP_INTENT_DEFINITIONS[intent];

    expect(definition.personaType).toBeNull();
    expect(definition.organizationType).toBe(type);
    expect(definition.initialMembershipRole).toBe(
      OrganizationMembershipRole.OWNER,
    );
    expect(definition.initialMembershipStatus).toBe(
      OrganizationMembershipStatus.ACTIVE,
    );
    expect(definition.initialOrganizationVerificationStatus).toBe(
      OrganizationVerificationStatus.PENDING,
    );
    expect(isOrganizationSignupIntent(intent)).toBe(true);
  });

  it.each(Object.values(SignupIntent))(
    'requires email verification before session issuance for %s',
    (intent) => {
      const definition = SIGNUP_INTENT_DEFINITIONS[intent];

      expect(definition.initialAccountStatus).toBe(
        AccountStatus.PENDING_VERIFICATION,
      );
      expect(definition.requiresEmailVerification).toBe(true);
    },
  );

  it('fails closed for an unknown runtime intent', () => {
    expect(isOrganizationSignupIntent('unknown' as SignupIntent)).toBe(false);
  });
});
