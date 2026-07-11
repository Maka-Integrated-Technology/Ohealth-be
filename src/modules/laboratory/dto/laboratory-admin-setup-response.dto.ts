import { ApiProperty } from '@nestjs/swagger';

import { UserRole } from '../../user/enums/user-role.enum';
import { LaboratoryOnboardingStatus } from '../enums/laboratory-onboarding-status.enum';
import { LaboratoryVerificationStatus } from '../enums/laboratory-verification-status.enum';

class LaboratorySetupResponseDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  id: string;

  @ApiProperty({ example: 'MedCheck Diagnostics' })
  name: string;

  @ApiProperty({ example: 'RC-123456' })
  registration_number: string;

  @ApiProperty({ example: 'LAB-987654' })
  license_number: string;

  @ApiProperty({ example: '12 Admiralty Way, Lekki, Lagos' })
  address: string;

  @ApiProperty({ example: 'Lagos' })
  region: string;

  @ApiProperty({ example: 'hello@medcheck.example' })
  contact_email: string;

  @ApiProperty({ example: '+2348012345678' })
  contact_phone: string;

  @ApiProperty({
    enum: LaboratoryVerificationStatus,
    example: LaboratoryVerificationStatus.PENDING,
  })
  verification_status: LaboratoryVerificationStatus;

  @ApiProperty({
    enum: LaboratoryOnboardingStatus,
    example: LaboratoryOnboardingStatus.ADMIN_SETUP_COMPLETED,
  })
  onboarding_status: LaboratoryOnboardingStatus;

  @ApiProperty({ example: true })
  is_active: boolean;

  @ApiProperty({ example: '2026-07-11T10:30:00.000Z' })
  created_at: Date;
}

class LaboratoryAdministratorSetupResponseDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440001' })
  id: string;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440002' })
  user_id: string;

  @ApiProperty({ example: 'Tunde Adebayo' })
  full_name: string;

  @ApiProperty({ example: 'tunde@medcheck.example' })
  email: string;

  @ApiProperty({ example: '+2348098765432' })
  phone: string;

  @ApiProperty({ example: [UserRole.LAB_ADMIN], enum: UserRole, isArray: true })
  role: UserRole[];

  @ApiProperty({ example: true })
  is_primary: boolean;
}

export class LaboratoryAdminSetupResponseDto {
  @ApiProperty({
    example: 'laboratory administrator setup completed successfully',
  })
  message: string;

  @ApiProperty({ type: LaboratorySetupResponseDto })
  laboratory: LaboratorySetupResponseDto;

  @ApiProperty({ type: LaboratoryAdministratorSetupResponseDto })
  administrator: LaboratoryAdministratorSetupResponseDto;

  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
  access_token: string;

  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
  refresh_token: string;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440003' })
  session_id: string;

  @ApiProperty({ example: '2026-07-18T10:30:00.000Z' })
  session_expires_at: Date;
}
