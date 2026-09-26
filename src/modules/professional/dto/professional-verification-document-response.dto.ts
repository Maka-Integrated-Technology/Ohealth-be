import { ApiProperty } from '@nestjs/swagger';

import { ProfessionalVerificationDocumentType } from '../enums/professional-verification-document-type.enum';

export class ProfessionalVerificationDocumentResponseDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  id: string;

  @ApiProperty({
    enum: ProfessionalVerificationDocumentType,
    example: ProfessionalVerificationDocumentType.PROFESSIONAL_LICENSE,
  })
  document_type: ProfessionalVerificationDocumentType;

  @ApiProperty({ example: 'license.pdf' })
  original_filename: string;

  @ApiProperty({ example: 'application/pdf' })
  mime_type: string;

  @ApiProperty({ example: 1048576 })
  file_size: number;

  @ApiProperty({ example: '2026-07-15T10:30:00.000Z' })
  created_at: Date;

  @ApiProperty({ example: '2026-07-15T10:30:00.000Z' })
  updated_at: Date;
}

export class ProfessionalVerificationDocumentsStatusDto {
  @ApiProperty({ type: [ProfessionalVerificationDocumentResponseDto] })
  documents: ProfessionalVerificationDocumentResponseDto[];

  @ApiProperty({
    enum: ProfessionalVerificationDocumentType,
    isArray: true,
    example: [ProfessionalVerificationDocumentType.GOVERNMENT_ID],
  })
  missing_document_types: ProfessionalVerificationDocumentType[];

  @ApiProperty({ example: false })
  is_complete: boolean;
}

export class ProfessionalVerificationDocumentDownloadDto {
  @ApiProperty({ example: 'https://signed-url.example.com/document' })
  url: string;

  @ApiProperty({ example: 300 })
  expires_in_seconds: number;
}
