import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

import { LaboratoryOnboardingStatus } from '../enums/laboratory-onboarding-status.enum';
import { LaboratoryVerificationStatus } from '../enums/laboratory-verification-status.enum';

export class LaboratoryVerificationStatusResponseDto {
  @ApiProperty({ example: '9e0f3a29-2b1c-4d83-9e29-3f2d6a9a21bd' })
  laboratory_id: string;

  @ApiProperty({
    enum: LaboratoryVerificationStatus,
    example: LaboratoryVerificationStatus.SUBMITTED,
  })
  verification_status: LaboratoryVerificationStatus;

  @ApiProperty({
    enum: LaboratoryOnboardingStatus,
    example: LaboratoryOnboardingStatus.VERIFICATION_SUBMITTED,
  })
  onboarding_status: LaboratoryOnboardingStatus;

  @ApiPropertyOptional({
    nullable: true,
    example: 'The submitted license is expired.',
  })
  verification_rejection_reason: string | null;

  @ApiProperty({ example: '2026-07-17T10:30:00.000Z' })
  updated_at: Date;
}

export class LaboratoryVerificationStatusHistoryResponseDto {
  @ApiProperty({ example: 'e2db2a75-f98d-4c1e-a4c0-0f2fb9c96f83' })
  id: string;

  @ApiProperty({ example: '9e0f3a29-2b1c-4d83-9e29-3f2d6a9a21bd' })
  laboratory_id: string;

  @ApiPropertyOptional({
    enum: LaboratoryVerificationStatus,
    nullable: true,
    example: LaboratoryVerificationStatus.SUBMITTED,
  })
  previous_status: LaboratoryVerificationStatus | null;

  @ApiProperty({
    enum: LaboratoryVerificationStatus,
    example: LaboratoryVerificationStatus.UNDER_REVIEW,
  })
  new_status: LaboratoryVerificationStatus;

  @ApiPropertyOptional({
    nullable: true,
    example: 'The submitted license is expired.',
  })
  reason: string | null;

  @ApiProperty({
    example: 'ad09bc1e-3644-4ca9-82f2-2e597db2d6ac',
  })
  changed_by_user_id: string;

  @ApiProperty({ example: '2026-07-17T10:30:00.000Z' })
  created_at: Date;
}

export class RejectLaboratoryVerificationDto {
  @ApiProperty({
    example: 'The accreditation certificate is not readable.',
    maxLength: 1000,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  reason: string;
}
