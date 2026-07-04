import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import {
  ConsultationType,
  ProfessionalVerificationStatus,
} from '../entities/professional.entity';

class ProfessionalMeUserDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  email: string;

  @ApiProperty()
  first_name: string;

  @ApiProperty()
  last_name: string;

  @ApiPropertyOptional()
  phone?: string;

  @ApiProperty({ type: [String] })
  roles: string[];

  @ApiProperty()
  is_verified: boolean;
}

class ProfessionalSetupStatusDto {
  @ApiProperty()
  verified: boolean;

  @ApiProperty()
  set_availability: boolean;

  @ApiProperty()
  add_profile_photo: boolean;

  @ApiProperty()
  add_description: boolean;

  @ApiProperty()
  completed: boolean;
}

export class ProfessionalMeProfileDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  user_id: string;

  @ApiProperty()
  speciality_id: string;

  @ApiProperty()
  speciality: string;

  @ApiPropertyOptional()
  image?: string;

  @ApiPropertyOptional()
  about?: string;

  @ApiPropertyOptional()
  license_number?: string;

  @ApiProperty()
  years_of_experience: number;

  @ApiProperty()
  consultation_fee: number;

  @ApiProperty({ enum: ConsultationType })
  consultation_type: ConsultationType;

  @ApiProperty({ enum: ProfessionalVerificationStatus })
  verification_status: ProfessionalVerificationStatus;

  @ApiProperty()
  profile_setup_completed: boolean;

  @ApiProperty()
  is_available: boolean;

  @ApiProperty()
  created_at: Date;

  @ApiProperty()
  updated_at: Date;
}

export class ProfessionalMeResponseDto {
  @ApiProperty({ type: ProfessionalMeUserDto })
  user: ProfessionalMeUserDto;

  @ApiPropertyOptional({ type: ProfessionalMeProfileDto, nullable: true })
  profile: ProfessionalMeProfileDto | null;

  @ApiProperty({ type: ProfessionalSetupStatusDto })
  setup: ProfessionalSetupStatusDto;
}

export type ProfessionalSetupStatus = {
  verified: boolean;
  set_availability: boolean;
  add_profile_photo: boolean;
  add_description: boolean;
  completed: boolean;
};
