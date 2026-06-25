import { ApiProperty } from '@nestjs/swagger';

export class ReviewResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  reviewer_id: string;

  @ApiProperty()
  professional_id: string;

  @ApiProperty({ minimum: 1, maximum: 5 })
  rating: number;

  @ApiProperty({ required: false })
  comment?: string;

  @ApiProperty({ required: false })
  booking_id?: string;

  @ApiProperty()
  created_at: Date;
}
