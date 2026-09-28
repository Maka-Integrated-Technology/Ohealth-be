import { ApiProperty } from '@nestjs/swagger';

export class ProfessionalAvailabilityResponseDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  id: string;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440001' })
  professional_id: string;

  @ApiProperty({ example: '2026-07-15', format: 'date' })
  date: string;

  @ApiProperty({ example: '09:00' })
  start_time: string;

  @ApiProperty({ example: '09:30' })
  end_time: string;

  @ApiProperty({ example: true })
  is_available: boolean;

  @ApiProperty({ example: '2026-01-15T10:30:00.000Z', format: 'date-time' })
  created_at: Date;

  @ApiProperty({ example: '2026-01-15T10:30:00.000Z', format: 'date-time' })
  updated_at: Date;
}
