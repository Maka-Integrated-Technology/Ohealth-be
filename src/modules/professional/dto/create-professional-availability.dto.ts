import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsNotEmpty,
  IsString,
  Matches,
  ValidateNested,
} from 'class-validator';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^\d{2}:\d{2}$/;

export class AvailabilitySlotDto {
  @ApiProperty({ example: '2026-07-15' })
  @IsString()
  @IsNotEmpty()
  @Matches(DATE_PATTERN, { message: 'date must be YYYY-MM-DD' })
  date: string;

  @ApiProperty({ example: '09:00' })
  @IsString()
  @IsNotEmpty()
  @Matches(TIME_PATTERN, { message: 'start_time must be HH:MM' })
  start_time: string;

  @ApiProperty({ example: '09:30' })
  @IsString()
  @IsNotEmpty()
  @Matches(TIME_PATTERN, { message: 'end_time must be HH:MM' })
  end_time: string;
}

export class BulkCreateAvailabilityDto {
  @ApiProperty({ type: [AvailabilitySlotDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => AvailabilitySlotDto)
  slots: AvailabilitySlotDto[];
}
