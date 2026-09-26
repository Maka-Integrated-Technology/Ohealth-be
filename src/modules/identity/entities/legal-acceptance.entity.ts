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
import { LegalDocumentType } from '../enums/legal-document-type.enum';

@Unique('UQ_legal_acceptances_user_document_version', [
  'user_id',
  'document_type',
  'document_version',
])
@Index('IDX_legal_acceptances_user_id', ['user_id'])
@Check(
  'CHK_legal_acceptances_document_type',
  `"document_type" IN ('terms_of_service', 'privacy_policy')`,
)
@Entity('legal_acceptances')
export class LegalAcceptance extends BaseEntity {
  @ManyToOne(() => User, (user) => user.legal_acceptances, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'user_id',
    foreignKeyConstraintName: 'FK_legal_acceptances_user_id',
  })
  user: User;

  @Column({ type: 'uuid' })
  user_id: string;

  @Column({ type: 'varchar' })
  document_type: LegalDocumentType;

  @Column({ type: 'varchar' })
  document_version: string;

  @Column({ type: 'timestamp with time zone' })
  accepted_at: Date;

  @Column({ type: 'inet', nullable: true })
  ip_address?: string | null;

  @Column({ type: 'text', nullable: true })
  user_agent?: string | null;
}
