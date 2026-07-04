import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { BookingStatus } from '../../booking/entities/booking.entity';

import {
  ProfessionalMeProfileDto,
  ProfessionalSetupStatus,
} from './professional-me-response.dto';

export class ProfessionalAppointmentResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  patient_id: string;

  @ApiProperty()
  patient_name: string;

  @ApiProperty()
  professional_id: string;

  @ApiProperty()
  booking_date: string;

  @ApiProperty()
  booking_time: string;

  @ApiProperty()
  consultation_type: string;

  @ApiProperty()
  amount: number;

  @ApiProperty({ enum: BookingStatus })
  status: BookingStatus;

  @ApiPropertyOptional()
  notes?: string;

  @ApiProperty()
  is_paid: boolean;

  @ApiProperty()
  created_at: Date;
}

class ProfessionalDashboardStatsDto {
  @ApiProperty()
  patients: number;

  @ApiProperty()
  patient_growth_percent: number;

  @ApiProperty()
  todays_appointments: number;

  @ApiProperty()
  pending_appointments: number;
}

class ProfessionalActivityResponseDto {
  @ApiProperty()
  title: string;

  @ApiProperty()
  message: string;

  @ApiProperty()
  occurred_at: Date;
}

export class ProfessionalDashboardResponseDto {
  @ApiProperty()
  date: string;

  @ApiProperty({ type: ProfessionalMeProfileDto })
  profile: ProfessionalMeProfileDto;

  @ApiProperty({ type: ProfessionalDashboardStatsDto })
  stats: ProfessionalDashboardStatsDto;

  @ApiProperty({ type: [ProfessionalAppointmentResponseDto] })
  todays_appointments: ProfessionalAppointmentResponseDto[];

  @ApiProperty({ type: [ProfessionalAppointmentResponseDto] })
  appointment_requests: ProfessionalAppointmentResponseDto[];

  @ApiProperty({ type: [ProfessionalActivityResponseDto] })
  activities: ProfessionalActivityResponseDto[];

  @ApiProperty()
  setup: ProfessionalSetupStatus;
}
