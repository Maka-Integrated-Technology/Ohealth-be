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
import { OrganizationMembershipRole } from '../enums/organization-membership-role.enum';
import { OrganizationMembershipStatus } from '../enums/organization-membership-status.enum';

import { Organization } from './organization.entity';

@Unique('UQ_organization_memberships_organization_user', [
  'organization_id',
  'user_id',
])
@Index('IDX_organization_memberships_user_id', ['user_id'])
@Index('IDX_organization_memberships_organization_id', ['organization_id'])
@Check(
  'CHK_organization_memberships_role',
  `"role" IN ('owner', 'admin', 'member')`,
)
@Check(
  'CHK_organization_memberships_status',
  `"status" IN ('invited', 'active', 'suspended', 'removed')`,
)
@Check(
  'CHK_organization_memberships_permissions',
  `jsonb_typeof("permission_overrides") = 'array'`,
)
@Entity('organization_memberships')
export class OrganizationMembership extends BaseEntity {
  @ManyToOne(() => Organization, (organization) => organization.memberships, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'organization_id',
    foreignKeyConstraintName: 'FK_organization_memberships_organization_id',
  })
  organization: Organization;

  @Column({ type: 'uuid' })
  organization_id: string;

  @ManyToOne(() => User, (user) => user.organization_memberships, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'user_id',
    foreignKeyConstraintName: 'FK_organization_memberships_user_id',
  })
  user: User;

  @Column({ type: 'uuid' })
  user_id: string;

  @Column({ type: 'varchar' })
  role: OrganizationMembershipRole;

  @Column({
    type: 'varchar',
    default: OrganizationMembershipStatus.ACTIVE,
  })
  status: OrganizationMembershipStatus;

  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  permission_overrides: string[];

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({
    name: 'invited_by_user_id',
    foreignKeyConstraintName: 'FK_organization_memberships_invited_by',
  })
  invited_by?: User | null;

  @Column({ type: 'uuid', nullable: true })
  invited_by_user_id?: string | null;

  @Column({ type: 'timestamp with time zone', nullable: true })
  joined_at?: Date | null;
}
