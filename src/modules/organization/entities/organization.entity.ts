import { Check, Column, Entity, Index, OneToMany, Unique } from 'typeorm';

import { BaseEntity } from '../../../entities/base-entity';
import { OrganizationType } from '../enums/organization-type.enum';
import { OrganizationVerificationStatus } from '../enums/organization-verification-status.enum';

import { OrganizationAdmin } from './organization-admin.entity';
import { OrganizationMembership } from './organization-membership.entity';
import { OrganizationStatusHistory } from './organization-status-history.entity';

@Unique('UQ_organizations_registration_number', ['registration_number'])
@Check(
  'CHK_organizations_type',
  `"organization_type" IN ('hospital', 'laboratory', 'pharmacy')`,
)
@Check(
  'CHK_organizations_verification_status',
  `"verification_status" IN ('pending', 'submitted', 'under_review', 'approved', 'rejected')`,
)
@Check(
  'CHK_organizations_rejection_reason',
  `"verification_status" <> 'rejected' OR NULLIF(BTRIM("rejection_reason"), '') IS NOT NULL`,
)
@Index('IDX_organizations_type', ['organization_type'])
@Index('IDX_organizations_verification_status', ['verification_status'])
@Entity('organizations')
export class Organization extends BaseEntity {
  @Column({ type: 'varchar' })
  organization_type: OrganizationType;

  @Column()
  name: string;

  @Column()
  registration_number: string;

  @Column({ type: 'text' })
  location: string;

  @Column()
  contact_email: string;

  @Column({ nullable: true })
  contact_phone: string | null;

  @Column({
    type: 'varchar',
    default: OrganizationVerificationStatus.PENDING,
  })
  verification_status: OrganizationVerificationStatus;

  @Column({ type: 'text', nullable: true })
  rejection_reason: string | null;

  @Column({ default: true })
  is_active: boolean;

  @OneToMany(() => OrganizationAdmin, (admin) => admin.organization)
  administrators: OrganizationAdmin[];

  @OneToMany(
    () => OrganizationMembership,
    (membership) => membership.organization,
  )
  memberships: OrganizationMembership[];

  @OneToMany(() => OrganizationStatusHistory, (history) => history.organization)
  status_history: OrganizationStatusHistory[];
}
