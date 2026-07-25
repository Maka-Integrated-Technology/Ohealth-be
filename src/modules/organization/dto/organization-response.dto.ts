import { ApiProperty } from '@nestjs/swagger';

import { UserRole } from '../../user/enums/user-role.enum';
import { OrganizationType } from '../enums/organization-type.enum';
import { OrganizationVerificationStatus } from '../enums/organization-verification-status.enum';

export class OrganizationResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ enum: OrganizationType })
  organization_type: OrganizationType;

  @ApiProperty()
  name: string;

  @ApiProperty()
  registration_number: string;

  @ApiProperty()
  location: string;

  @ApiProperty()
  contact_email: string;

  @ApiProperty({ nullable: true })
  contact_phone: string | null;

  @ApiProperty({ enum: OrganizationVerificationStatus })
  verification_status: OrganizationVerificationStatus;

  @ApiProperty({ nullable: true })
  rejection_reason: string | null;

  @ApiProperty()
  is_active: boolean;

  @ApiProperty()
  created_at: Date;
}

export class OrganizationAdministratorResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  user_id: string;

  @ApiProperty()
  full_name: string;

  @ApiProperty()
  email: string;

  @ApiProperty()
  phone: string;

  @ApiProperty({ enum: UserRole, isArray: true })
  roles: UserRole[];
}

export class SetupOrganizationResponseDto {
  @ApiProperty()
  message: string;

  @ApiProperty({ type: OrganizationResponseDto })
  organization: OrganizationResponseDto;

  @ApiProperty({ type: OrganizationAdministratorResponseDto })
  administrator: OrganizationAdministratorResponseDto;
}
