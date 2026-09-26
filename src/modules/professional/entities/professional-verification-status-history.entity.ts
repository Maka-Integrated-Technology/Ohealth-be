import { Check, Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';

import { BaseEntity } from '../../../entities/base-entity';
import { User } from '../../user/entities/user.entity';

import {
  Professional,
  ProfessionalVerificationStatus,
} from './professional.entity';

@Index(['professional_id'])
@Index(['new_status'])
@Check(
  'CHK_professional_verification_status_history_previous_status',
  `"previous_status" IS NULL OR "previous_status" IN ('pending', 'verified', 'rejected')`,
)
@Check(
  'CHK_professional_verification_status_history_new_status',
  `"new_status" IN ('pending', 'verified', 'rejected')`,
)
@Entity('professional_verification_status_history')
export class ProfessionalVerificationStatusHistory extends BaseEntity {
  @ManyToOne(() => Professional, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'professional_id' })
  professional: Professional;

  @Column({ type: 'uuid' })
  professional_id: string;

  @Column({ type: 'varchar', nullable: true })
  previous_status: ProfessionalVerificationStatus | null;

  @Column({ type: 'varchar' })
  new_status: ProfessionalVerificationStatus;

  @Column({ type: 'text', nullable: true })
  reason: string | null;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'changed_by_user_id' })
  changed_by: User;

  @Column({ type: 'uuid' })
  changed_by_user_id: string;
}
