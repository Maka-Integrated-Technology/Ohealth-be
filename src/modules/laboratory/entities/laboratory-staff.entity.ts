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
import { Organization } from '../../organization/entities/organization.entity';
import { User } from '../../user/entities/user.entity';
import {
  LaboratoryStaffRole,
  LaboratoryStaffStatus,
} from '../enums/laboratory-post-approval.enum';

@Unique('UQ_laboratory_staff_organization_email', ['organization_id', 'email'])
@Unique('UQ_laboratory_staff_user_id', ['user_id'])
@Unique('UQ_laboratory_staff_invitation_token_hash', ['invitation_token_hash'])
@Check(
  'CHK_laboratory_staff_invitation_lifecycle',
  `("status" = 'invited' AND "user_id" IS NULL AND "invitation_token_hash" IS NOT NULL AND "invitation_expires_at" IS NOT NULL AND "accepted_at" IS NULL)
    OR
   ("status" = 'active' AND "user_id" IS NOT NULL AND "invitation_token_hash" IS NULL AND "invitation_expires_at" IS NULL AND "accepted_at" IS NOT NULL)`,
)
@Check(
  'CHK_laboratory_staff_role',
  `"role" IN ('manager', 'scientist', 'technician', 'phlebotomist', 'receptionist')`,
)
@Check('CHK_laboratory_staff_status', `"status" IN ('invited', 'active')`)
@Index('IDX_laboratory_staff_organization_id', ['organization_id'])
@Index('IDX_laboratory_staff_status', ['status'])
@Entity('laboratory_staff')
export class LaboratoryStaff extends BaseEntity {
  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'organization_id',
    foreignKeyConstraintName: 'FK_laboratory_staff_organization_id',
  })
  organization: Organization;

  @Column({ type: 'uuid' })
  organization_id: string;

  @ManyToOne(() => User, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'user_id',
    foreignKeyConstraintName: 'FK_laboratory_staff_user_id',
  })
  user: User | null;

  @Column({ type: 'uuid', nullable: true })
  user_id: string | null;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'invited_by_user_id',
    foreignKeyConstraintName: 'FK_laboratory_staff_invited_by_user_id',
  })
  invited_by: User;

  @Column({ type: 'uuid' })
  invited_by_user_id: string;

  @Column()
  full_name: string;

  @Column()
  email: string;

  @Column({ type: 'varchar' })
  role: LaboratoryStaffRole;

  @Column({ type: 'varchar', default: LaboratoryStaffStatus.INVITED })
  status: LaboratoryStaffStatus;

  @Column({ type: 'char', length: 64, nullable: true })
  invitation_token_hash: string | null;

  @Column({ type: 'timestamp with time zone', nullable: true })
  invitation_expires_at: Date | null;

  @Column({ type: 'timestamp with time zone', nullable: true })
  accepted_at: Date | null;
}
