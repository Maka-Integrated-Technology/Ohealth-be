import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

import { ConsultationType } from '../entities/professional.entity';

export class UpsertProfessionalProfileDto {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174001' })
  @IsUUID()
  speciality_id: string;

  @ApiProperty({ example: 'MDCN-123456' })
  @IsString()
  license_number: string;

  @ApiProperty({ example: 8 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  years_of_experience: number;

  @ApiProperty({ enum: ConsultationType, example: ConsultationType.VIDEO })
  @IsEnum(ConsultationType)
  consultation_type: ConsultationType;

  @ApiProperty({
    required: false,
    example:
      'Experienced general practitioner focused on family medicine and preventive care.',
  })
  @IsString()
  @IsOptional()
  about?: string;

  @ApiProperty({ required: false, example: 'https://cdn.example.com/me.jpg' })
  @IsString()
  @IsOptional()
  image?: string;

  @ApiProperty({ required: false, example: 5000 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @IsOptional()
  consultation_fee?: number;
}
