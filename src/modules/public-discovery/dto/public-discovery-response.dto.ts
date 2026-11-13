import { ApiProperty } from '@nestjs/swagger';

import { ConsultationType } from '../../professional/entities/professional.entity';
import {
  PUBLIC_DISCOVERY_ICON,
  PublicProfessionalSortField,
  PublicSortOrder,
} from '../public-discovery.constants';

/**
 * Public response models are explicit allowlists. A field reaches an
 * unauthenticated consumer only if it is declared here and assigned by the
 * public mapper; entities are never serialized directly.
 */
export class PublicSpecialityDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'Cardiology' })
  name: string;

  @ApiProperty({ type: String, nullable: true })
  description: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    maxLength: PUBLIC_DISCOVERY_ICON.maxLength,
    pattern: PUBLIC_DISCOVERY_ICON.pattern,
    example: 'general-doctor',
    description:
      'Asset identifier the consumer maps to an icon it bundles. Never an address, file path, or storage key; a stored value outside this format is returned as null.',
  })
  icon: string | null;
}

export class PublicProfessionalSpecialityDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'Cardiology' })
  name: string;
}

export class PublicProfessionalSummaryDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'Ada Obi' })
  name: string;

  @ApiProperty({
    type: String,
    nullable: true,
    format: 'uri',
    description: 'Absolute HTTPS image address, when one is published',
  })
  image: string | null;

  @ApiProperty({ type: PublicProfessionalSpecialityDto })
  speciality: PublicProfessionalSpecialityDto;

  @ApiProperty({ example: 4.5 })
  rating: number;

  @ApiProperty({ type: 'integer', example: 12 })
  total_reviews: number;

  @ApiProperty({ example: 5000 })
  consultation_fee: number;

  @ApiProperty({ type: 'integer', example: 8 })
  years_of_experience: number;

  @ApiProperty({ enum: ConsultationType })
  consultation_type: ConsultationType;

  @ApiProperty()
  is_available: boolean;
}

export class PublicProfessionalDetailDto extends PublicProfessionalSummaryDto {
  @ApiProperty({ type: String, nullable: true })
  about: string | null;
}

export class PublicAvailabilitySlotDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: '09:00:00' })
  start_time: string;

  @ApiProperty({ example: '09:30:00' })
  end_time: string;
}

export class PublicAvailabilityDayDto {
  @ApiProperty({ format: 'date', example: '2026-01-15' })
  date: string;

  @ApiProperty({ type: [PublicAvailabilitySlotDto] })
  slots: PublicAvailabilitySlotDto[];
}

export class PublicPaginationMetaDto {
  @ApiProperty({ type: 'integer' })
  page: number;

  @ApiProperty({ type: 'integer' })
  limit: number;

  @ApiProperty({ type: 'integer' })
  total: number;

  @ApiProperty({ type: 'integer' })
  total_pages: number;

  @ApiProperty()
  has_next: boolean;

  @ApiProperty()
  has_previous: boolean;
}

export class PublicDiscoveryPaginationContractDto {
  @ApiProperty({ type: 'integer' })
  default_limit: number;

  @ApiProperty({ type: 'integer' })
  max_limit: number;

  @ApiProperty({ type: 'integer' })
  max_page: number;
}

export class PublicDiscoverySearchContractDto {
  @ApiProperty({ type: 'integer' })
  min_length: number;

  @ApiProperty({ type: 'integer' })
  max_length: number;
}

export class PublicDiscoveryProfessionalSortContractDto {
  @ApiProperty({
    enum: PublicProfessionalSortField,
    enumName: 'PublicProfessionalSortField',
    isArray: true,
  })
  fields: PublicProfessionalSortField[];

  @ApiProperty({
    enum: PublicSortOrder,
    enumName: 'PublicSortOrder',
    isArray: true,
  })
  orders: PublicSortOrder[];

  @ApiProperty({
    enum: PublicProfessionalSortField,
    enumName: 'PublicProfessionalSortField',
  })
  default_field: PublicProfessionalSortField;

  @ApiProperty({ enum: PublicSortOrder, enumName: 'PublicSortOrder' })
  default_order: PublicSortOrder;
}

export class PublicDiscoveryContractDto {
  @ApiProperty({ type: PublicDiscoveryPaginationContractDto })
  pagination: PublicDiscoveryPaginationContractDto;

  @ApiProperty({ type: PublicDiscoverySearchContractDto })
  search: PublicDiscoverySearchContractDto;

  @ApiProperty({ type: PublicDiscoveryProfessionalSortContractDto })
  professional_sort: PublicDiscoveryProfessionalSortContractDto;

  @ApiProperty({
    enum: ConsultationType,
    enumName: 'ConsultationType',
    isArray: true,
  })
  consultation_types: ConsultationType[];

  @ApiProperty({ type: 'integer' })
  max_availability_range_days: number;
}
