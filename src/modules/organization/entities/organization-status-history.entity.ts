import { Check, Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';

import { BaseEntity } from '../../../entities/base-entity';
import { User } from '../../user/entities/user.entity';
import { OrganizationVerificationStatus } from '../enums/organization-verification-status.enum';

import { Organization } from './organization.entity';

@Check(
  'CHK_organization_status_history_previous',
  `"previous_status" IS NULL OR "previous_status" IN ('pending', 'submitted', 'under_review', 'approved', 'rejected')`,
)
@Check(
  'CHK_organization_status_history_new',
  `"new_status" IN ('pending', 'submitted', 'under_review', 'approved', 'rejected')`,
)
@Index('IDX_organization_status_history_organization_id', ['organization_id'])
@Entity('organization_status_history')
export class OrganizationStatusHistory extends BaseEntity {
  @ManyToOne(
    () => Organization,
    (organization) => organization.status_history,
    { onDelete: 'RESTRICT' },
  )
  @JoinColumn({
    name: 'organization_id',
    foreignKeyConstraintName: 'FK_organization_status_history_organization_id',
  })
  organization: Organization;

  @Column({ type: 'uuid' })
  organization_id: string;

  @Column({ type: 'varchar', nullable: true })
  previous_status: OrganizationVerificationStatus | null;

  @Column({ type: 'varchar' })
  new_status: OrganizationVerificationStatus;

  @Column({ type: 'text', nullable: true })
  reason: string | null;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'changed_by_user_id',
    foreignKeyConstraintName: 'FK_organization_status_history_changed_by',
  })
  changed_by: User;

  @Column({ type: 'uuid' })
  changed_by_user_id: string;
}
