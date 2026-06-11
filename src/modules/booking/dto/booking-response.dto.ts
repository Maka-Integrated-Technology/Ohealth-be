import { ApiProperty } from '@nestjs/swagger';

export class BookingResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  patient_id: string;

  @ApiProperty()
  professional_id: string;

  @ApiProperty()
  professional_name: string;

  @ApiProperty({ required: false })
  professional_image?: string;

  @ApiProperty()
  speciality_id: string;

  @ApiProperty()
  speciality_name: string;

  @ApiProperty()
  booking_date: string;

  @ApiProperty()
  booking_time: string;

  @ApiProperty()
  consultation_type: string;

  @ApiProperty()
  amount: number;

  @ApiProperty()
  status: string;

  @ApiProperty({ enum: ['paid', 'unpaid'] })
  payment_status: 'paid' | 'unpaid';

  @ApiProperty({ required: false })
  notes?: string;

  @ApiProperty()
  is_paid: boolean;

  @ApiProperty()
  created_at: Date;
}
