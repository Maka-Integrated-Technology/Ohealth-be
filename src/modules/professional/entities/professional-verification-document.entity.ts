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
import { ProfessionalVerificationDocumentType } from '../enums/professional-verification-document-type.enum';

import { Professional } from './professional.entity';

@Unique(['professional_id', 'document_type'])
@Check(
  'CHK_professional_verification_documents_type',
  `"document_type" IN ('professional_license', 'government_id')`,
)
@Index(['professional_id'])
@Index(['document_type'])
@Entity('professional_verification_documents')
export class ProfessionalVerificationDocument extends BaseEntity {
  @ManyToOne(() => Professional, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'professional_id' })
  professional: Professional;

  @Column({ name: 'professional_id' })
  professional_id: string;

  @Column({ type: 'varchar' })
  document_type: ProfessionalVerificationDocumentType;

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
