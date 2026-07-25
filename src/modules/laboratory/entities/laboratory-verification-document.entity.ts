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
import { LaboratoryVerificationDocumentType } from '../enums/laboratory-verification-document-type.enum';

import { Laboratory } from './laboratory.entity';

@Unique(['laboratory_id', 'document_type'])
@Check(
  'CHK_laboratory_verification_documents_type',
  `"document_type" IN ('laboratory_license', 'accreditation_certificate', 'cac_registration', 'identity_verification')`,
)
@Index(['laboratory_id'])
@Index(['document_type'])
@Entity('laboratory_verification_documents')
export class LaboratoryVerificationDocument extends BaseEntity {
  @ManyToOne(() => Laboratory, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'laboratory_id' })
  laboratory: Laboratory;

  @Column({ name: 'laboratory_id' })
  laboratory_id: string;

  @Column({ type: 'varchar' })
  document_type: LaboratoryVerificationDocumentType;

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

  @ManyToOne(() => User, { onDelete: 'NO ACTION' })
  @JoinColumn({ name: 'uploaded_by_user_id' })
  uploaded_by: User;

  @Column({ name: 'uploaded_by_user_id' })
  uploaded_by_user_id: string;
}
