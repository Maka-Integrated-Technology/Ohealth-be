import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

import { OrganizationDocumentType } from '../enums/organization-document-type.enum';
import { OrganizationType } from '../enums/organization-type.enum';
import { OrganizationVerificationStatus } from '../enums/organization-verification-status.enum';

import { OrganizationResponseDto } from './organization-response.dto';

export class RejectOrganizationDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  reason: string;
}

export class OrganizationReviewQueryDto {
  @ApiPropertyOptional({ enum: OrganizationType })
  @IsOptional()
  @IsEnum(OrganizationType)
  organization_type?: OrganizationType;

  @ApiPropertyOptional({ enum: OrganizationVerificationStatus })
  @IsOptional()
  @IsEnum(OrganizationVerificationStatus)
  verification_status?: OrganizationVerificationStatus;

  @ApiPropertyOptional({ type: Number, default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({ type: Number, default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;
}

export class OrganizationDocumentResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ enum: OrganizationDocumentType })
  document_type: OrganizationDocumentType;

  @ApiProperty()
  original_filename: string;

  @ApiProperty()
  mime_type: string;

  @ApiProperty()
  file_size: number;

  @ApiProperty()
  created_at: Date;

  @ApiProperty()
  updated_at: Date;
}

export class OrganizationDocumentChecklistDto {
  @ApiProperty({ type: [OrganizationDocumentResponseDto] })
  documents: OrganizationDocumentResponseDto[];

  @ApiProperty({ enum: OrganizationDocumentType, isArray: true })
  missing_document_types: OrganizationDocumentType[];

  @ApiProperty()
  is_complete: boolean;
}

export class OrganizationDocumentDownloadDto {
  @ApiProperty()
  url: string;

  @ApiProperty()
  expires_in_seconds: number;
}

export class OrganizationStatusResponseDto {
  @ApiProperty()
  organization_id: string;

  @ApiProperty({ enum: OrganizationVerificationStatus })
  verification_status: OrganizationVerificationStatus;

  @ApiProperty({ nullable: true })
  rejection_reason: string | null;

  @ApiProperty()
  updated_at: Date;
}

export class OrganizationStatusHistoryResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  organization_id: string;

  @ApiProperty({ enum: OrganizationVerificationStatus, nullable: true })
  previous_status: OrganizationVerificationStatus | null;

  @ApiProperty({ enum: OrganizationVerificationStatus })
  new_status: OrganizationVerificationStatus;

  @ApiProperty({ nullable: true })
  reason: string | null;

  @ApiProperty()
  changed_by_user_id: string;

  @ApiProperty()
  created_at: Date;
}

export class OrganizationReviewListResponseDto {
  @ApiProperty({ type: [OrganizationResponseDto] })
  applications: OrganizationResponseDto[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  page: number;

  @ApiProperty()
  limit: number;
}
