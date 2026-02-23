import { ApiProperty } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export enum ConsultationType {
  CHAT = 'chat',
  VIDEO = 'video',
}

export class CreateBookingDto {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  @IsUUID()
  @IsNotEmpty()
  professional_id: string;

  @ApiProperty({ example: '2024-02-10' })
  @IsString()
  @IsNotEmpty()
  booking_date: string;

  @ApiProperty({ example: '10:00' })
  @IsString()
  @IsNotEmpty()
  booking_time: string;

  @ApiProperty({ enum: ConsultationType, example: ConsultationType.VIDEO })
  @IsEnum(ConsultationType)
  @IsNotEmpty()
  consultation_type: ConsultationType;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  notes?: string;
}
