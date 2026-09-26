import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

import { ProfessionalVerificationStatus } from '../entities/professional.entity';

export class RejectProfessionalVerificationDto {
  @ApiProperty({
    example: 'The submitted license number could not be verified.',
  })
  @IsString()
  @IsNotEmpty()
  reason: string;
}

export class ProfessionalVerificationStatusResponseDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  professional_id: string;

  @ApiProperty({
    enum: ProfessionalVerificationStatus,
    example: ProfessionalVerificationStatus.PENDING,
  })
  verification_status: ProfessionalVerificationStatus;

  @ApiProperty({ example: true })
  documents_complete: boolean;
}

export class ProfessionalVerificationStatusHistoryResponseDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  id: string;

  @ApiProperty({
    enum: ProfessionalVerificationStatus,
    nullable: true,
    example: ProfessionalVerificationStatus.PENDING,
  })
  previous_status: ProfessionalVerificationStatus | null;

  @ApiProperty({
    enum: ProfessionalVerificationStatus,
    example: ProfessionalVerificationStatus.VERIFIED,
  })
  new_status: ProfessionalVerificationStatus;

  @ApiProperty({ nullable: true, example: null })
  reason: string | null;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  changed_by_user_id: string;

  @ApiProperty({ example: '2026-07-15T10:30:00.000Z' })
  created_at: Date;
}
