import { ApiProperty } from '@nestjs/swagger';

class AvailabilitySlotResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  start_time: string;

  @ApiProperty()
  end_time: string;

  @ApiProperty()
  is_available: boolean;
}

class GroupedAvailabilityDto {
  @ApiProperty()
  date: string;

  @ApiProperty({ type: [AvailabilitySlotResponseDto] })
  slots: AvailabilitySlotResponseDto[];
}

export class ProfessionalResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty({ required: false })
  image?: string;

  @ApiProperty()
  speciality_id: string;

  @ApiProperty()
  speciality: string;

  @ApiProperty()
  rating: number;

  @ApiProperty()
  total_reviews: number;

  @ApiProperty()
  consultation_fee: number;

  @ApiProperty()
  years_of_experience: number;

  @ApiProperty({ required: false })
  about?: string;

  @ApiProperty()
  consultation_type: string;

  @ApiProperty()
  is_available: boolean;
}

export class ProfessionalDetailResponseDto extends ProfessionalResponseDto {
  @ApiProperty({ type: [GroupedAvailabilityDto] })
  availabilities: GroupedAvailabilityDto[];
}
