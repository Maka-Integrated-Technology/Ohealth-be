import { UserRole } from '../../user/enums/user-role.enum';
import { LaboratoryOnboardingStatus } from '../enums/laboratory-onboarding-status.enum';
import { LaboratoryVerificationStatus } from '../enums/laboratory-verification-status.enum';

export interface ILaboratoryAdminSetupResult {
  message: string;
  laboratory: {
    id: string;
    name: string;
    registration_number: string;
    license_number: string;
    address: string;
    region: string;
    contact_email: string;
    contact_phone: string;
    verification_status: LaboratoryVerificationStatus;
    onboarding_status: LaboratoryOnboardingStatus;
    is_active: boolean;
    created_at: Date;
  };
  administrator: {
    id: string;
    user_id: string;
    full_name: string;
    email: string;
    phone: string;
    role: UserRole[];
    is_primary: boolean;
  };
  access_token: string;
  refresh_token: string;
  session_id: string;
  session_expires_at: Date;
}
