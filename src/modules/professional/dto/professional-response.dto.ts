import { ApiProperty } from '@nestjs/swagger';

export class ProfessionalResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  image?: string;

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

  @ApiProperty()
  about?: string;

  @ApiProperty()
  consultation_type: string;

  @ApiProperty()
  is_available: boolean;
}

export class ProfessionalDetailResponseDto extends ProfessionalResponseDto {
  @ApiProperty({ type: [Object] })
  availabilities: {
    date: string;
    slots: { start_time: string; end_time: string; is_available: boolean }[];
  }[];
}
