export enum LaboratoryVerificationDocumentType {
  LABORATORY_LICENSE = 'laboratory_license',
  ACCREDITATION_CERTIFICATE = 'accreditation_certificate',
  CAC_REGISTRATION = 'cac_registration',
  IDENTITY_VERIFICATION = 'identity_verification',
}

export const REQUIRED_LABORATORY_VERIFICATION_DOCUMENT_TYPES: readonly LaboratoryVerificationDocumentType[] =
  [
    LaboratoryVerificationDocumentType.LABORATORY_LICENSE,
    LaboratoryVerificationDocumentType.ACCREDITATION_CERTIFICATE,
    LaboratoryVerificationDocumentType.CAC_REGISTRATION,
    LaboratoryVerificationDocumentType.IDENTITY_VERIFICATION,
  ];
