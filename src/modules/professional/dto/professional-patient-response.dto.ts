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
  total_notes: number;

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

  @ApiPropertyOptional({ nullable: true })
  age: number | null;

  @ApiPropertyOptional({ nullable: true })
  registered_at: Date | null;

  @ApiProperty({ type: [String] })
  medical_conditions: string[];

  @ApiProperty({ type: [String] })
  allergies: string[];

  @ApiPropertyOptional({ nullable: true })
  blood_group: string | null;

  @ApiPropertyOptional({ nullable: true })
  height_cm: number | null;

  @ApiPropertyOptional({ nullable: true })
  weight_kg: number | null;

  @ApiPropertyOptional({ nullable: true })
  genotype: string | null;

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

export class ProfessionalPatientPersonalInformationDto {
  @ApiProperty()
  full_name: string;

  @ApiPropertyOptional({ nullable: true })
  dob: string | null;

  @ApiPropertyOptional({ nullable: true })
  gender: string | null;

  @ApiProperty()
  email: string;

  @ApiPropertyOptional({ nullable: true })
  registered_at: Date | null;

  @ApiProperty()
  patient_reference: string;
}

export class ProfessionalPatientMedicalInformationDto {
  @ApiPropertyOptional({ nullable: true })
  height_cm: number | null;

  @ApiPropertyOptional({ nullable: true })
  weight_kg: number | null;

  @ApiPropertyOptional({ nullable: true })
  blood_group: string | null;

  @ApiPropertyOptional({ nullable: true })
  genotype: string | null;

  @ApiProperty({ type: [String] })
  medical_conditions: string[];

  @ApiProperty({ type: [String] })
  allergies: string[];

  @ApiPropertyOptional({ nullable: true })
  primary_condition: string | null;

  @ApiPropertyOptional({ nullable: true })
  primary_allergy: string | null;
}

export class ProfessionalPatientNoteResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  professional_id: string;

  @ApiProperty()
  patient_id: string;

  @ApiProperty()
  content: string;

  @ApiProperty()
  date_label: string;

  @ApiProperty()
  created_at: Date;

  @ApiProperty()
  updated_at: Date;
}

export class ProfessionalPatientConsultationHistoryItemDto extends ProfessionalAppointmentResponseDto {
  @ApiProperty()
  date_day: string;

  @ApiProperty()
  date_month_year: string;

  @ApiProperty()
  consultation_label: string;

  @ApiProperty()
  time_label: string;

  @ApiProperty()
  schedule_label: string;

  @ApiPropertyOptional({ nullable: true })
  description: string | null;
}

export class ProfessionalPatientDetailResponseDto {
  @ApiProperty({ type: ProfessionalPatientProfileDto })
  profile: ProfessionalPatientProfileDto;

  @ApiProperty({ type: ProfessionalPatientPersonalInformationDto })
  personal_information: ProfessionalPatientPersonalInformationDto;

  @ApiProperty({ type: ProfessionalPatientMedicalInformationDto })
  medical_information: ProfessionalPatientMedicalInformationDto;

  @ApiProperty({ type: ProfessionalPatientSummaryDto })
  summary: ProfessionalPatientSummaryDto;

  @ApiProperty({ type: [ProfessionalPatientConsultationHistoryItemDto] })
  consultation_history: ProfessionalPatientConsultationHistoryItemDto[];

  @ApiProperty({ type: [ProfessionalPatientNoteResponseDto] })
  notes: ProfessionalPatientNoteResponseDto[];

  @ApiProperty({ type: [ProfessionalPatientLabResultDto] })
  lab_results: ProfessionalPatientLabResultDto[];
}

export class ProfessionalPatientConsultationsResponseDto {
  @ApiProperty({ type: ProfessionalPatientProfileDto })
  profile: ProfessionalPatientProfileDto;

  @ApiProperty({ type: ProfessionalPatientSummaryDto })
  summary: ProfessionalPatientSummaryDto;

  @ApiProperty({ type: [ProfessionalPatientConsultationHistoryItemDto] })
  records: ProfessionalPatientConsultationHistoryItemDto[];

  @ApiProperty({ type: ProfessionalPatientsPaginationMetaDto })
  meta: ProfessionalPatientsPaginationMetaDto;
}

export class ProfessionalPatientNotesResponseDto {
  @ApiProperty({ type: ProfessionalPatientProfileDto })
  profile: ProfessionalPatientProfileDto;

  @ApiProperty({ type: ProfessionalPatientSummaryDto })
  summary: ProfessionalPatientSummaryDto;

  @ApiProperty({ type: [ProfessionalPatientNoteResponseDto] })
  records: ProfessionalPatientNoteResponseDto[];

  @ApiProperty({ type: ProfessionalPatientsPaginationMetaDto })
  meta: ProfessionalPatientsPaginationMetaDto;
}
