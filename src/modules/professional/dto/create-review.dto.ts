import { ApiProperty } from '@nestjs/swagger';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export class CreateReviewDto {
  @ApiProperty({ example: 5, minimum: 1, maximum: 5 })
  @IsInt()
  @IsNotEmpty()
  @Min(1)
  @Max(5)
  rating: number;

  @ApiProperty({ required: false, example: 'Very helpful and professional.' })
  @IsString()
  @IsOptional()
  comment?: string;

  @ApiProperty({
    required: false,
    example: '123e4567-e89b-12d3-a456-426614174000',
    description:
      'Booking ID this review is tied to. Prevents duplicate reviews.',
  })
  @IsUUID()
  @IsOptional()
  booking_id?: string;
}
