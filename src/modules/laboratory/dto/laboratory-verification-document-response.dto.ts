import { ApiProperty } from '@nestjs/swagger';

import { LaboratoryVerificationDocumentType } from '../enums/laboratory-verification-document-type.enum';

export class LaboratoryVerificationDocumentResponseDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  id: string;

  @ApiProperty({
    enum: LaboratoryVerificationDocumentType,
    example: LaboratoryVerificationDocumentType.LABORATORY_LICENSE,
  })
  document_type: LaboratoryVerificationDocumentType;

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

export class LaboratoryVerificationDocumentsStatusDto {
  @ApiProperty({ type: [LaboratoryVerificationDocumentResponseDto] })
  documents: LaboratoryVerificationDocumentResponseDto[];

  @ApiProperty({
    enum: LaboratoryVerificationDocumentType,
    isArray: true,
    example: [LaboratoryVerificationDocumentType.CAC_REGISTRATION],
  })
  missing_document_types: LaboratoryVerificationDocumentType[];

  @ApiProperty({ example: false })
  is_complete: boolean;
}

export class LaboratoryVerificationDocumentDownloadDto {
  @ApiProperty({ example: 'https://signed-url.example.com/document' })
  url: string;

  @ApiProperty({ example: 300 })
  expires_in_seconds: number;
}
