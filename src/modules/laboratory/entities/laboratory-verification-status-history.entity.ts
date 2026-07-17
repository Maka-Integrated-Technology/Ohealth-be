import { Check, Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';

import { BaseEntity } from '../../../entities/base-entity';
import { User } from '../../user/entities/user.entity';
import { LaboratoryVerificationStatus } from '../enums/laboratory-verification-status.enum';

import { Laboratory } from './laboratory.entity';

@Index(['laboratory_id'])
@Index(['new_status'])
@Check(
  'CHK_laboratory_verification_status_history_previous_status',
  `"previous_status" IS NULL OR "previous_status" IN ('pending', 'submitted', 'under_review', 'approved', 'rejected')`,
)
@Check(
  'CHK_laboratory_verification_status_history_new_status',
  `"new_status" IN ('pending', 'submitted', 'under_review', 'approved', 'rejected')`,
)
@Entity('laboratory_verification_status_history')
export class LaboratoryVerificationStatusHistory extends BaseEntity {
  @ManyToOne(
    () => Laboratory,
    (laboratory) => laboratory.verification_history,
    {
      onDelete: 'RESTRICT',
    },
  )
  @JoinColumn({ name: 'laboratory_id' })
  laboratory: Laboratory;

  @Column({ type: 'uuid' })
  laboratory_id: string;

  @Column({ type: 'varchar', nullable: true })
  previous_status: LaboratoryVerificationStatus | null;

  @Column({ type: 'varchar' })
  new_status: LaboratoryVerificationStatus;

  @Column({ type: 'text', nullable: true })
  reason: string | null;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'changed_by_user_id' })
  changed_by: User;

  @Column({ type: 'uuid' })
  changed_by_user_id: string;
}
