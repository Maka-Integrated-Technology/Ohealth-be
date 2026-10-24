import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';

import { BaseEntity } from '../../../entities/base-entity';
import { User } from '../../user/entities/user.entity';

@Entity('auth_sessions')
export class AuthSession extends BaseEntity {
  @Column({ unique: true })
  session_id: string;

  @Column()
  user_id: string;

  @ManyToOne(() => User, (user) => user.sessions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ default: 1 })
  credential_version: number;

  @Column({ type: 'timestamp with time zone', nullable: true })
  last_used_at?: Date | null;

  @Column()
  refresh_token_hash: string;

  @Column({ type: 'timestamp with time zone' })
  expires_at: Date;

  @Column({ type: 'timestamp with time zone', nullable: true })
  revoked_at?: Date | null;
}
