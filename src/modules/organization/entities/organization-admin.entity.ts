import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToOne,
  Unique,
} from 'typeorm';

import { BaseEntity } from '../../../entities/base-entity';
import { User } from '../../user/entities/user.entity';

import { Organization } from './organization.entity';

@Unique('UQ_organization_admins_user_id', ['user_id'])
@Unique('UQ_organization_admins_organization_user', [
  'organization_id',
  'user_id',
])
@Index('IDX_organization_admins_organization_id', ['organization_id'])
@Entity('organization_admins')
export class OrganizationAdmin extends BaseEntity {
  @ManyToOne(
    () => Organization,
    (organization) => organization.administrators,
    { onDelete: 'CASCADE' },
  )
  @JoinColumn({
    name: 'organization_id',
    foreignKeyConstraintName: 'FK_organization_admins_organization_id',
  })
  organization: Organization;

  @Column({ type: 'uuid' })
  organization_id: string;

  @OneToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'user_id',
    foreignKeyConstraintName: 'FK_organization_admins_user_id',
  })
  user: User;

  @Column({ type: 'uuid' })
  user_id: string;

  @Column()
  full_name: string;

  @Column()
  phone: string;

  @Column({ default: true })
  is_primary: boolean;
}
