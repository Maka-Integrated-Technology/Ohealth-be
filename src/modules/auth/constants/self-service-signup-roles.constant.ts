import { UserRole } from '../../user/enums/user-role.enum';

export const SELF_SERVICE_SIGNUP_ROLES: readonly UserRole[] = [
  UserRole.PATIENT,
  UserRole.DOCTOR,
  UserRole.THERAPIST,
  UserRole.COUNSELLOR,
  UserRole.LAB_PROFESSIONAL,
] as const;
