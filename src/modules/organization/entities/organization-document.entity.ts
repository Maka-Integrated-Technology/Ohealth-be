import {
  Check,
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  Unique,
} from 'typeorm';

import { BaseEntity } from '../../../entities/base-entity';
import { User } from '../../user/entities/user.entity';
import { OrganizationDocumentType } from '../enums/organization-document-type.enum';

import { Organization } from './organization.entity';

@Unique('UQ_organization_documents_organization_type', [
  'organization_id',
  'document_type',
])
@Check(
  'CHK_organization_documents_type',
  `"document_type" IN ('operating_license', 'business_registration', 'accreditation_certificate', 'admin_identity')`,
)
@Index('IDX_organization_documents_organization_id', ['organization_id'])
@Entity('organization_documents')
export class OrganizationDocument extends BaseEntity {
  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'organization_id',
    foreignKeyConstraintName: 'FK_organization_documents_organization_id',
  })
  organization: Organization;

  @Column({ type: 'uuid' })
  organization_id: string;

  @Column({ type: 'varchar' })
  document_type: OrganizationDocumentType;

  @Column()
  bucket: string;

  @Column()
  storage_key: string;

  @Column()
  original_filename: string;

  @Column()
  mime_type: string;

  @Column({ type: 'int' })
  file_size: number;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'uploaded_by_user_id',
    foreignKeyConstraintName: 'FK_organization_documents_uploaded_by',
  })
  uploaded_by: User;

  @Column({ type: 'uuid' })
  uploaded_by_user_id: string;
}
