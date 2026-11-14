import { UserPersonaType } from '../../identity/enums/user-persona-type.enum';
import { OrganizationMembershipRole } from '../../organization/enums/organization-membership-role.enum';
import { OrganizationMembershipStatus } from '../../organization/enums/organization-membership-status.enum';
import { OrganizationType } from '../../organization/enums/organization-type.enum';
import { OrganizationVerificationStatus } from '../../organization/enums/organization-verification-status.enum';
import { ProfessionalVerificationStatus } from '../../professional/entities/professional.entity';
import { AccountStatus } from '../../user/enums/account-status.enum';

export interface IAuthAccountContext {
  account: {
    id: string;
    email: string;
    first_name: string;
    last_name: string;
    status: AccountStatus;
    email_verified: boolean;
    created_at: Date;
    profile: {
      middle_name: string | null;
      gender: string | null;
      dob: string | null;
      phone: string | null;
      country: string | null;
      image: string | null;
      updated_at: Date;
    };
  };
  personas: Array<{
    type: UserPersonaType;
    is_active: boolean;
  }>;
  professional: {
    verification_status: ProfessionalVerificationStatus;
    profile_setup_completed: boolean;
    is_active: boolean;
  } | null;
  memberships: Array<{
    organization_id: string;
    organization_type: OrganizationType;
    organization_name: string;
    organization_verification_status: OrganizationVerificationStatus;
    organization_is_active: boolean;
    role: OrganizationMembershipRole;
    status: OrganizationMembershipStatus;
    permission_overrides: string[];
  }>;
  capabilities: string[];
  session: {
    id: string;
    expires_at: Date;
    last_used_at: Date | null;
  };
}
