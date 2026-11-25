import { Check, Column, Entity, OneToMany, OneToOne } from 'typeorm';

import { BaseEntity } from '../../../entities/base-entity';
import { AuthSession } from '../../auth/entities/auth.entity';
import { User2fa } from '../../auth/entities/user-2fa.entity';
import { LegalAcceptance } from '../../identity/entities/legal-acceptance.entity';
import { UserPersona } from '../../identity/entities/user-persona.entity';
import { OrganizationMembership } from '../../organization/entities/organization-membership.entity';
import { AccountStatus } from '../enums/account-status.enum';

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
  country?: string | null;

  @Column({ nullable: true })
  image?: string | null;

  @Column({ default: false })
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

  @Column({ default: true })
  password_authentication_enabled: boolean;

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
