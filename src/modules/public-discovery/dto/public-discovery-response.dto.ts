import { ApiProperty, ApiSchema } from '@nestjs/swagger';

import { ConsultationType } from '../../professional/entities/professional.entity';
import {
  PUBLIC_DISCOVERY_ICON,
  PUBLIC_DISCOVERY_LOCAL_TIME_PATTERN,
  PUBLIC_DISCOVERY_TEXT,
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

  @ApiProperty({
    example: 'Cardiology',
    maxLength: PUBLIC_DISCOVERY_TEXT.labelMaxLength,
    description: 'Plain text on one line; never HTML',
  })
  name: string;

  @ApiProperty({
    type: String,
    nullable: true,
    maxLength: PUBLIC_DISCOVERY_TEXT.proseMaxLength,
    description:
      'Plain text; never HTML. Null when the stored text is absent, too long, or contains markup.',
  })
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

  @ApiProperty({
    example: 'Cardiology',
    maxLength: PUBLIC_DISCOVERY_TEXT.labelMaxLength,
    description: 'Plain text on one line; never HTML',
  })
  name: string;
}

export class PublicProfessionalSummaryDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({
    example: 'Ada Obi',
    maxLength: PUBLIC_DISCOVERY_TEXT.labelMaxLength,
    description: 'Display name as plain text on one line; never HTML',
  })
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

  @ApiProperty({
    example: 4.5,
    description:
      'Average of the review ratings, rounded to two decimal places; 0 when there are no reviews',
  })
  rating: number;

  @ApiProperty({
    type: 'integer',
    example: 12,
    description: 'Number of reviews the rating is the average of',
  })
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
  @ApiProperty({
    type: String,
    nullable: true,
    maxLength: PUBLIC_DISCOVERY_TEXT.proseMaxLength,
    example: 'Consultant cardiologist with ten years of clinical practice.',
    description:
      'Biography as plain text; never HTML, so render it as text. Published as written, or null when the stored text is absent, too long, or contains markup.',
  })
  about: string | null;
}

@ApiSchema({
  description:
    'One period a professional offers. `date`, `start_time`, and `end_time` are local to `time_zone`; `starts_at` and `ends_at` are the same period as instants.',
})
export class PublicAvailabilitySlotDto {
  @ApiProperty({
    format: 'uuid',
    description:
      'Identifier of the slot. Knowing it reserves nothing; booking creation checks the slot again.',
  })
  id: string;

  @ApiProperty({
    example: '09:00:00',
    pattern: PUBLIC_DISCOVERY_LOCAL_TIME_PATTERN,
    description: 'Local start time on the day, in `time_zone`',
  })
  start_time: string;

  @ApiProperty({
    example: '09:30:00',
    pattern: PUBLIC_DISCOVERY_LOCAL_TIME_PATTERN,
    description:
      'Local end time in `time_zone`. A value that is not after `start_time` falls on the following day.',
  })
  end_time: string;

  @ApiProperty({
    example: 'Africa/Lagos',
    description:
      'IANA time zone name that `date`, `start_time`, and `end_time` are local to. It is stored with the slot and never taken from the server.',
  })
  time_zone: string;

  @ApiProperty({
    format: 'date-time',
    example: '2026-01-15T08:00:00.000Z',
    description: 'Instant the slot starts, in UTC',
  })
  starts_at: string;

  @ApiProperty({
    format: 'date-time',
    example: '2026-01-15T08:30:00.000Z',
    description: 'Instant the slot ends, in UTC',
  })
  ends_at: string;
}

export class PublicAvailabilityDayDto {
  @ApiProperty({
    format: 'date',
    example: '2026-01-15',
    description:
      'Calendar date the slots start on, local to the `time_zone` of each slot',
  })
  date: string;

  @ApiProperty({
    type: [PublicAvailabilitySlotDto],
    description: 'Slots of the day, earliest first',
  })
  slots: PublicAvailabilitySlotDto[];
}

@ApiSchema({
  description:
    'Slots one professional offered when the response was produced. It is information, not a reservation: a slot can be taken at any moment after `as_of`, and booking creation revalidates and reserves a slot atomically and can still refuse it.',
})
export class PublicProfessionalAvailabilityDto {
  @ApiProperty({
    format: 'date',
    example: '2026-01-15',
    description: 'First calendar date of the range that was read',
  })
  from: string;

  @ApiProperty({
    format: 'date',
    example: '2026-01-21',
    description: 'Last calendar date of the range that was read',
  })
  to: string;

  @ApiProperty({
    format: 'date-time',
    example: '2026-01-14T10:30:00.000Z',
    description:
      'Instant the slots were read, in UTC. Every returned slot started after it and was neither withdrawn nor occupied by a booking at that instant.',
  })
  as_of: string;

  @ApiProperty({
    type: [PublicAvailabilityDayDto],
    description:
      'Days that have at least one slot, in chronological order. A day without slots is absent.',
  })
  days: PublicAvailabilityDayDto[];

  @ApiProperty({
    description:
      'True when the range holds more slots than one response returns. Request a range that starts on the last returned date to read the rest.',
  })
  has_more: boolean;
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

export class PublicSpecialityCatalogueDto {
  @ApiProperty({ type: [PublicSpecialityDto] })
  items: PublicSpecialityDto[];

  @ApiProperty({ type: PublicPaginationMetaDto })
  meta: PublicPaginationMetaDto;
}

export class PublicProfessionalDirectoryDto {
  @ApiProperty({ type: [PublicProfessionalSummaryDto] })
  items: PublicProfessionalSummaryDto[];

  @ApiProperty({ type: PublicPaginationMetaDto })
  meta: PublicPaginationMetaDto;
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

  @ApiProperty({ type: 'integer' })
  max_availability_slots: number;
}
