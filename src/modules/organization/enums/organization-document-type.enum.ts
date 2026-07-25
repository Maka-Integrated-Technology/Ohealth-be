import { OrganizationType } from './organization-type.enum';

export enum OrganizationDocumentType {
  OPERATING_LICENSE = 'operating_license',
  BUSINESS_REGISTRATION = 'business_registration',
  ACCREDITATION_CERTIFICATE = 'accreditation_certificate',
  ADMIN_IDENTITY = 'admin_identity',
}

export const REQUIRED_ORGANIZATION_DOCUMENT_TYPES: Readonly<
  Record<OrganizationType, readonly OrganizationDocumentType[]>
> = {
  [OrganizationType.HOSPITAL]: [
    OrganizationDocumentType.OPERATING_LICENSE,
    OrganizationDocumentType.BUSINESS_REGISTRATION,
    OrganizationDocumentType.ACCREDITATION_CERTIFICATE,
    OrganizationDocumentType.ADMIN_IDENTITY,
  ],
  [OrganizationType.LABORATORY]: [
    OrganizationDocumentType.OPERATING_LICENSE,
    OrganizationDocumentType.BUSINESS_REGISTRATION,
    OrganizationDocumentType.ACCREDITATION_CERTIFICATE,
    OrganizationDocumentType.ADMIN_IDENTITY,
  ],
  [OrganizationType.PHARMACY]: [
    OrganizationDocumentType.OPERATING_LICENSE,
    OrganizationDocumentType.BUSINESS_REGISTRATION,
    OrganizationDocumentType.ADMIN_IDENTITY,
  ],
};
