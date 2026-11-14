import { ApiProperty } from '@nestjs/swagger';

import { UserPersonaType } from '../../identity/enums/user-persona-type.enum';
import { OrganizationMembershipRole } from '../../organization/enums/organization-membership-role.enum';
import { OrganizationMembershipStatus } from '../../organization/enums/organization-membership-status.enum';
import { OrganizationType } from '../../organization/enums/organization-type.enum';
import { OrganizationVerificationStatus } from '../../organization/enums/organization-verification-status.enum';
import { ProfessionalVerificationStatus } from '../../professional/entities/professional.entity';
import { AccountStatus } from '../../user/enums/account-status.enum';
import { UserRole } from '../../user/enums/user-role.enum';
import { AuthChallengeContinuationDto } from '../contracts/auth-contract-response.dto';
import { AuthAccessLevel, AuthRoutingTarget } from '../enums/auth-routing.enum';

export class TokensDto {
  @ApiProperty({
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    description: 'JWT access token with 15 minutes expiration',
  })
  access_token: string;

  @ApiProperty({
    example: '4s0Y1Vv7P4QkFQhp4nHq2dc6_bVdI0kQ6-1pMbx2YpA',
    description: 'Opaque, rotating refresh credential',
  })
  refresh_token: string;
}

class AuthAccountProfileResponseDto {
  @ApiProperty({ nullable: true }) middle_name: string | null;
  @ApiProperty({ nullable: true }) gender: string | null;
  @ApiProperty({ nullable: true }) dob: string | null;
  @ApiProperty({ nullable: true }) phone: string | null;
  @ApiProperty({ nullable: true }) country: string | null;
  @ApiProperty({ nullable: true }) image: string | null;
  @ApiProperty({ format: 'date-time' }) updated_at: Date;
}

class AuthAccountResponseDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty() email: string;
  @ApiProperty() first_name: string;
  @ApiProperty() last_name: string;
  @ApiProperty({ enum: AccountStatus }) status: AccountStatus;
  @ApiProperty() email_verified: boolean;
  @ApiProperty({ format: 'date-time' }) created_at: Date;
  @ApiProperty({ type: AuthAccountProfileResponseDto })
  profile: AuthAccountProfileResponseDto;
}

class AuthPersonaResponseDto {
  @ApiProperty({ enum: UserPersonaType }) type: UserPersonaType;
  @ApiProperty() is_active: boolean;
}

class AuthProfessionalResponseDto {
  @ApiProperty({ enum: ProfessionalVerificationStatus })
  verification_status: ProfessionalVerificationStatus;
  @ApiProperty() profile_setup_completed: boolean;
  @ApiProperty() is_active: boolean;
}

class AuthMembershipResponseDto {
  @ApiProperty({ format: 'uuid' }) organization_id: string;
  @ApiProperty({ enum: OrganizationType }) organization_type: OrganizationType;
  @ApiProperty() organization_name: string;
  @ApiProperty({ enum: OrganizationVerificationStatus })
  organization_verification_status: OrganizationVerificationStatus;
  @ApiProperty() organization_is_active: boolean;
  @ApiProperty({ enum: OrganizationMembershipRole })
  role: OrganizationMembershipRole;
  @ApiProperty({ enum: OrganizationMembershipStatus })
  status: OrganizationMembershipStatus;
  @ApiProperty({ type: [String] }) permission_overrides: string[];
}

class AuthSessionContextResponseDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ format: 'date-time' }) expires_at: Date;
  @ApiProperty({ format: 'date-time', nullable: true })
  last_used_at: Date | null;
}

export class AuthContextResponseDto {
  @ApiProperty({ format: 'uuid', nullable: true })
  active_organization_id: string | null;

  @ApiProperty({ type: AuthAccountResponseDto })
  account: AuthAccountResponseDto;

  @ApiProperty({ type: [AuthPersonaResponseDto] })
  personas: AuthPersonaResponseDto[];

  @ApiProperty({ type: AuthProfessionalResponseDto, nullable: true })
  professional: AuthProfessionalResponseDto | null;

  @ApiProperty({ type: [AuthMembershipResponseDto] })
  memberships: AuthMembershipResponseDto[];

  @ApiProperty({ type: [String] })
  capabilities: string[];

  @ApiProperty({ type: AuthSessionContextResponseDto })
  session: AuthSessionContextResponseDto;
}

export class AuthMeResponseDto {
  @ApiProperty({ deprecated: true }) id: string;
  @ApiProperty({ deprecated: true }) email: string;
  @ApiProperty({ deprecated: true }) first_name: string;
  @ApiProperty({ deprecated: true }) last_name: string;
  @ApiProperty({ type: [String], deprecated: true }) role: UserRole[];
  @ApiProperty({ nullable: true, deprecated: true }) middle_name: string | null;
  @ApiProperty({ nullable: true, deprecated: true }) gender: string | null;
  @ApiProperty({ nullable: true, deprecated: true }) dob: string | null;
  @ApiProperty({ nullable: true, deprecated: true }) phone: string | null;
  @ApiProperty({ nullable: true, deprecated: true }) country: string | null;
  @ApiProperty({ nullable: true, deprecated: true }) image: string | null;
  @ApiProperty({ deprecated: true }) is_active: boolean;
  @ApiProperty({ format: 'date-time', deprecated: true }) created_at: Date;
  @ApiProperty({ format: 'date-time', deprecated: true }) updated_at: Date;
  @ApiProperty({ type: AuthContextResponseDto })
  account_context: AuthContextResponseDto;
}

export class CanonicalAuthResponseDto extends TokensDto {
  @ApiProperty({
    type: AuthContextResponseDto,
    description:
      'Server-resolved account, persona, membership, verification, and capability context',
  })
  account_context: AuthContextResponseDto;

  @ApiProperty({ deprecated: true })
  user: {
    id: string;
    email: string;
    first_name: string;
    last_name: string;
    role: UserRole[];
  };

  @ApiProperty({ enum: AuthRoutingTarget, deprecated: true })
  routing_target: AuthRoutingTarget;

  @ApiProperty({ enum: AuthAccessLevel, deprecated: true })
  access_level: AuthAccessLevel;

  @ApiProperty({ nullable: true, deprecated: true })
  verification_status: string | null;
}

export class LoginResponseDto extends CanonicalAuthResponseDto {
  @ApiProperty({
    example: 200,
    nullable: true,
  })
  status_code?: number;

  @ApiProperty({
    example: 'Login success',
    nullable: true,
  })
  message?: string;

  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    nullable: true,
  })
  session_id?: string;

  @ApiProperty({
    example: '2024-01-15T10:30:00Z',
    nullable: true,
  })
  session_expires_at?: Date;
}

export class LoginChallengeResponseDto extends AuthChallengeContinuationDto {}

export class VerifySignupResponseDto extends LoginResponseDto {
  @ApiProperty({ example: 'account verified' })
  message: string;
}

export class RefreshTokenResponseDto extends CanonicalAuthResponseDto {
  @ApiProperty({
    example: 200,
    nullable: true,
  })
  status_code?: number;

  @ApiProperty({
    example: 'Token refresh successful',
    nullable: true,
  })
  message?: string;

  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  session_id: string;

  @ApiProperty({
    example: '2024-01-15T10:30:00Z',
  })
  session_expires_at: Date;
}
export class LogoutResponseDto {
  @ApiProperty({
    example: 200,
    nullable: true,
  })
  status_code?: number;

  @ApiProperty({
    example: 'logout success',
    nullable: true,
  })
  message?: string;
}
