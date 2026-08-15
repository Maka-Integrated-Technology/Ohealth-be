import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { BookingStatus } from '../../booking/entities/booking.entity';

import { ProfessionalAppointmentResponseDto } from './professional-dashboard-response.dto';

export enum ProfessionalPatientSortBy {
  PATIENT = 'patient',
  ID = 'id',
  CONDITION = 'condition',
  LAST_VISIT = 'last_visit',
}

export class ProfessionalPatientSummaryDto {
  @ApiProperty()
  total_consultations: number;

  @ApiProperty()
  completed_consultations: number;

  @ApiProperty()
  upcoming_appointments: number;

  @ApiPropertyOptional({ nullable: true })
  last_visit_date: string | null;
}

export class ProfessionalPatientProfileDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  first_name: string;

  @ApiProperty()
  last_name: string;

  @ApiProperty()
  full_name: string;

  @ApiProperty()
  patient_reference: string;

  @ApiProperty()
  email: string;

  @ApiPropertyOptional({ nullable: true })
  phone: string | null;

  @ApiPropertyOptional({ nullable: true })
  image: string | null;

  @ApiPropertyOptional({ nullable: true })
  gender: string | null;

  @ApiPropertyOptional({ nullable: true })
  dob: string | null;

  @ApiProperty({ type: [String] })
  medical_conditions: string[];

  @ApiProperty({ type: [String] })
  allergies: string[];

  @ApiPropertyOptional({ nullable: true })
  blood_group: string | null;

  @ApiPropertyOptional({ nullable: true })
  emergency_contact_name: string | null;

  @ApiPropertyOptional({ nullable: true })
  emergency_contact_phone: string | null;
}

export class ProfessionalPatientListItemDto extends ProfessionalPatientProfileDto {
  @ApiProperty()
  condition: string;

  @ApiProperty()
  total_consultations: number;

  @ApiPropertyOptional({ nullable: true })
  last_visit_date: string | null;

  @ApiPropertyOptional({ nullable: true })
  last_booking_id: string | null;

  @ApiPropertyOptional({ enum: BookingStatus, nullable: true })
  last_booking_status: BookingStatus | null;
}

export class ProfessionalPatientsPaginationMetaDto {
  @ApiProperty()
  page: number;

  @ApiProperty()
  limit: number;

  @ApiProperty()
  total: number;

  @ApiProperty()
  total_pages: number;

  @ApiProperty()
  showing: number;

  @ApiProperty()
  has_next: boolean;

  @ApiProperty()
  has_previous: boolean;
}

export class ProfessionalPatientRecordsResponseDto {
  @ApiProperty({ type: [ProfessionalPatientListItemDto] })
  records: ProfessionalPatientListItemDto[];

  @ApiProperty({ type: ProfessionalPatientsPaginationMetaDto })
  meta: ProfessionalPatientsPaginationMetaDto;
}

export class ProfessionalPatientLabResultDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  test_type: string;

  @ApiProperty()
  test_date: string;

  @ApiProperty()
  lab_name: string;

  @ApiProperty()
  source: string;

  @ApiProperty()
  status: string;
}

export class ProfessionalPatientDetailResponseDto {
  @ApiProperty({ type: ProfessionalPatientProfileDto })
  profile: ProfessionalPatientProfileDto;

  @ApiProperty({ type: ProfessionalPatientSummaryDto })
  summary: ProfessionalPatientSummaryDto;

  @ApiProperty({ type: [ProfessionalAppointmentResponseDto] })
  consultation_history: ProfessionalAppointmentResponseDto[];

  @ApiProperty({ type: [ProfessionalPatientLabResultDto] })
  lab_results: ProfessionalPatientLabResultDto[];
}
