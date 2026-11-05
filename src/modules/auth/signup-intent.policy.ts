import { UserPersonaType } from '../identity/enums/user-persona-type.enum';
import { OrganizationMembershipRole } from '../organization/enums/organization-membership-role.enum';
import { OrganizationMembershipStatus } from '../organization/enums/organization-membership-status.enum';
import { OrganizationType } from '../organization/enums/organization-type.enum';
import { OrganizationVerificationStatus } from '../organization/enums/organization-verification-status.enum';
import { AccountStatus } from '../user/enums/account-status.enum';

import { SignupIntent } from './enums/signup-intent.enum';

interface ISignupIntentDefinition {
  label: string;
  personaType: UserPersonaType | null;
  organizationType: OrganizationType | null;
  initialAccountStatus: AccountStatus.PENDING_VERIFICATION;
  requiresEmailVerification: true;
  initialMembershipRole: OrganizationMembershipRole.OWNER | null;
  initialMembershipStatus: OrganizationMembershipStatus.ACTIVE | null;
  initialOrganizationVerificationStatus: OrganizationVerificationStatus.PENDING | null;
}

export const SIGNUP_INTENT_DEFINITIONS = {
  [SignupIntent.PATIENT]: {
    label: 'Patient',
    personaType: UserPersonaType.PATIENT,
    organizationType: null,
    initialAccountStatus: AccountStatus.PENDING_VERIFICATION,
    requiresEmailVerification: true,
    initialMembershipRole: null,
    initialMembershipStatus: null,
    initialOrganizationVerificationStatus: null,
  },
  [SignupIntent.HEALTHCARE_PROFESSIONAL]: {
    label: 'Healthcare Professional',
    personaType: UserPersonaType.HEALTHCARE_PROFESSIONAL,
    organizationType: null,
    initialAccountStatus: AccountStatus.PENDING_VERIFICATION,
    requiresEmailVerification: true,
    initialMembershipRole: null,
    initialMembershipStatus: null,
    initialOrganizationVerificationStatus: null,
  },
  [SignupIntent.PHARMACY]: {
    label: 'Pharmacy',
    personaType: null,
    organizationType: OrganizationType.PHARMACY,
    initialAccountStatus: AccountStatus.PENDING_VERIFICATION,
    requiresEmailVerification: true,
    initialMembershipRole: OrganizationMembershipRole.OWNER,
    initialMembershipStatus: OrganizationMembershipStatus.ACTIVE,
    initialOrganizationVerificationStatus:
      OrganizationVerificationStatus.PENDING,
  },
  [SignupIntent.LABORATORY]: {
    label: 'Laboratory',
    personaType: null,
    organizationType: OrganizationType.LABORATORY,
    initialAccountStatus: AccountStatus.PENDING_VERIFICATION,
    requiresEmailVerification: true,
    initialMembershipRole: OrganizationMembershipRole.OWNER,
    initialMembershipStatus: OrganizationMembershipStatus.ACTIVE,
    initialOrganizationVerificationStatus:
      OrganizationVerificationStatus.PENDING,
  },
  [SignupIntent.HOSPITAL]: {
    label: 'Hospital',
    personaType: null,
    organizationType: OrganizationType.HOSPITAL,
    initialAccountStatus: AccountStatus.PENDING_VERIFICATION,
    requiresEmailVerification: true,
    initialMembershipRole: OrganizationMembershipRole.OWNER,
    initialMembershipStatus: OrganizationMembershipStatus.ACTIVE,
    initialOrganizationVerificationStatus:
      OrganizationVerificationStatus.PENDING,
  },
} as const satisfies Record<SignupIntent, ISignupIntentDefinition>;

export function isOrganizationSignupIntent(
  intent: SignupIntent,
): intent is
  | SignupIntent.PHARMACY
  | SignupIntent.LABORATORY
  | SignupIntent.HOSPITAL {
  return (
    intent === SignupIntent.PHARMACY ||
    intent === SignupIntent.LABORATORY ||
    intent === SignupIntent.HOSPITAL
  );
}
