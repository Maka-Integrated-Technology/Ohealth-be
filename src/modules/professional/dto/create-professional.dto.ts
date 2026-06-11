import { ApiProperty } from '@nestjs/swagger';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

import { ConsultationType } from '../entities/professional.entity';

export class CreateProfessionalDto {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  @IsUUID()
  @IsNotEmpty()
  user_id: string;

  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174001' })
  @IsUUID()
  @IsNotEmpty()
  speciality_id: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  image?: string;

  @ApiProperty({
    required: false,
    example: 'Experienced general practitioner.',
  })
  @IsString()
  @IsOptional()
  about?: string;

  @ApiProperty({ required: false, example: 8 })
  @IsInt()
  @Min(0)
  @IsOptional()
  years_of_experience?: number;

  @ApiProperty({ example: 5000 })
  @IsNumber()
  @Min(0)
  consultation_fee: number;

  @ApiProperty({ enum: ConsultationType, default: ConsultationType.BOTH })
  @IsEnum(ConsultationType)
  @IsOptional()
  consultation_type?: ConsultationType;
}
