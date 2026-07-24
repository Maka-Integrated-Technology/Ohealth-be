import { User } from '../../user/entities/user.entity';
import { OrganizationAdmin } from '../entities/organization-admin.entity';
import { Organization } from '../entities/organization.entity';
import { OrganizationType } from '../enums/organization-type.enum';

export interface INormalizedOrganizationSetup {
  organizationType: OrganizationType;
  name: string;
  registrationNumber: string;
  location: string;
  contactEmail: string;
  contactPhone: string | null;
}

export interface INormalizedOrganizationAdministrator {
  fullName: string;
  email: string;
  phone: string;
  password: string;
}

export interface IParsedAdministratorName {
  firstName: string;
  lastName: string;
  middleName: string | null;
}

export interface ICreatedOrganizationAdministrator {
  organization: Organization;
  administrator: OrganizationAdmin;
  user: User;
}
