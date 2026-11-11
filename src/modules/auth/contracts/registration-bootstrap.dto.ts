import { ApiProperty } from '@nestjs/swagger';

import { LegalDocumentType } from '../../identity/enums/legal-document-type.enum';
import { SignupIntent } from '../enums/signup-intent.enum';

export class RegistrationBootstrapIntentDto {
  @ApiProperty({
    enum: SignupIntent,
    enumName: 'SignupIntent',
    description:
      'Closed self-service account type that determines persona or organization type.',
  })
  intent: SignupIntent;

  @ApiProperty({ example: 'Patient' })
  label: string;
}

export class RegistrationBootstrapLegalDocumentDto {
  @ApiProperty({ enum: LegalDocumentType, enumName: 'LegalDocumentType' })
  document_type: LegalDocumentType;

  @ApiProperty({ example: '2026-08-01' })
  version: string;
}

export class RegistrationBootstrapDto {
  @ApiProperty({ type: [RegistrationBootstrapIntentDto] })
  intents: RegistrationBootstrapIntentDto[];

  @ApiProperty({ type: RegistrationBootstrapLegalDocumentDto })
  terms: RegistrationBootstrapLegalDocumentDto;

  @ApiProperty({ type: RegistrationBootstrapLegalDocumentDto })
  privacy: RegistrationBootstrapLegalDocumentDto;
}
