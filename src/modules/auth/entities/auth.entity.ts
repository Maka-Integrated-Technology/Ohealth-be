import {
  Check,
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
} from 'typeorm';

import { BaseEntity } from '../../../entities/base-entity';
import { User } from '../../user/entities/user.entity';

import { RefreshCredential } from './refresh-credential.entity';

@Check('CHK_auth_sessions_credential_version', '"credential_version" IN (1, 2)')
@Entity('auth_sessions')
export class AuthSession extends BaseEntity {
  @Column({ unique: true })
  session_id: string;

  @Column()
  user_id: string;

  @ManyToOne(() => User, (user) => user.sessions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column()
  refresh_token_hash: string;

  @Column({ type: 'smallint', default: 1 })
  credential_version: number;

  @Column({ type: 'timestamp with time zone', nullable: true })
  last_used_at?: Date | null;

  @Column({ type: 'timestamp with time zone' })
  expires_at: Date;

  @Column({ type: 'timestamp with time zone', nullable: true })
  revoked_at?: Date | null;

  @OneToMany(() => RefreshCredential, (credential) => credential.session)
  refresh_credentials: RefreshCredential[];
}
