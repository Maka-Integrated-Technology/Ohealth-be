import { Check, Column, Entity, OneToMany, OneToOne } from 'typeorm';

import { BaseEntity } from '../../../entities/base-entity';
import { AuthSession } from '../../auth/entities/auth.entity';
import { User2fa } from '../../auth/entities/user-2fa.entity';
import { LegalAcceptance } from '../../identity/entities/legal-acceptance.entity';
import { UserPersona } from '../../identity/entities/user-persona.entity';
import { OrganizationMembership } from '../../organization/entities/organization-membership.entity';
import { AccountStatus } from '../enums/account-status.enum';
import { UserRole } from '../enums/user-role.enum';

@Check(
  'CHK_users_account_status',
  `"account_status" IN ('pending_verification', 'active', 'suspended', 'deactivated')`,
)
@Entity('users')
export class User extends BaseEntity {
  @Column({ unique: true })
  email: string;

  @Column()
  password: string;

  @Column()
  first_name: string;

  @Column()
  last_name: string;

  @Column({ nullable: true })
  middle_name?: string | null;

  @Column({ nullable: true })
  gender?: string | null;

  @Column({ type: 'date', nullable: true })
  dob?: string | null;

  @Column({ nullable: true })
  phone?: string | null;

  @Column({ nullable: true })
  image?: string | null;

  @Column({ type: 'simple-array', default: UserRole.PATIENT })
  role: UserRole[];

  @Column({ default: true })
  is_active: boolean;

  @Column({ default: false })
  is_verified: boolean;

  @Column({
    type: 'varchar',
    default: AccountStatus.PENDING_VERIFICATION,
  })
  account_status: AccountStatus;

  @Column({ type: 'timestamp with time zone', nullable: true })
  email_verified_at?: Date | null;

  @Column({ nullable: true })
  verification_code?: string | null;

  @Column({ type: 'timestamp with time zone', nullable: true })
  verification_code_expires_at?: Date | null;

  @Column({ nullable: true })
  google_id?: string | null;

  @Column({ nullable: true })
  reset_token?: string | null;

  @Column({ type: 'timestamp with time zone', nullable: true })
  reset_token_expiry?: Date | null;

  @OneToMany(() => AuthSession, (session) => session.user)
  sessions: AuthSession[];

  @OneToMany(() => UserPersona, (persona) => persona.user)
  personas: UserPersona[];

  @OneToMany(() => OrganizationMembership, (membership) => membership.user)
  organization_memberships: OrganizationMembership[];

  @OneToMany(() => LegalAcceptance, (acceptance) => acceptance.user)
  legal_acceptances: LegalAcceptance[];

  @OneToOne(() => User2fa, (user2fa) => user2fa.user)
  twoFa?: User2fa;
}
