export enum ProfessionalVerificationDocumentType {
  PROFESSIONAL_LICENSE = 'professional_license',
  GOVERNMENT_ID = 'government_id',
}

export const REQUIRED_PROFESSIONAL_VERIFICATION_DOCUMENT_TYPES: readonly ProfessionalVerificationDocumentType[] =
  [
    ProfessionalVerificationDocumentType.PROFESSIONAL_LICENSE,
    ProfessionalVerificationDocumentType.GOVERNMENT_ID,
  ];
