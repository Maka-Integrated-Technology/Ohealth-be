import { Column, Entity, OneToMany, OneToOne } from 'typeorm';

import { BaseEntity } from '../../../entities/base-entity';
import { AuthSession } from '../../auth/entities/auth.entity';
import { User2fa } from '../../auth/entities/user-2fa.entity';
import { UserRole } from '../enums/user-role.enum';

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

  @Column({ type: 'simple-array', default: UserRole.PATIENT })
  role: UserRole[];

  @Column({ default: true })
  is_active: boolean;

  @Column({ default: false })
  is_verified: boolean;

  @Column({ nullable: true })
  google_id?: string | null;

  @Column({ nullable: true })
  reset_token?: string | null;

  @Column({ type: 'timestamp with time zone', nullable: true })
  reset_token_expiry?: Date | null;

  @OneToMany(() => AuthSession, (session) => session.user)
  sessions: AuthSession[];

  @OneToOne(() => User2fa, (user2fa) => user2fa.user)
  twoFa?: User2fa;
}
