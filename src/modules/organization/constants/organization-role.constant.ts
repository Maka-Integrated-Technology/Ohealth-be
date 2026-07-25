import { UserRole } from '../../user/enums/user-role.enum';
import { OrganizationType } from '../enums/organization-type.enum';

export const ORGANIZATION_ADMIN_ROLE: Readonly<
  Record<OrganizationType, UserRole>
> = {
  [OrganizationType.HOSPITAL]: UserRole.HOSPITAL_ADMIN,
  [OrganizationType.LABORATORY]: UserRole.LAB_ADMIN,
  [OrganizationType.PHARMACY]: UserRole.PHARMACY_ADMIN,
};

export const ORGANIZATION_ADMIN_ROLES: readonly UserRole[] = Object.values(
  ORGANIZATION_ADMIN_ROLE,
);
