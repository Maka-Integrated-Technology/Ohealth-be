import { Entity, Column, JoinColumn, OneToOne } from 'typeorm';

import { BaseEntity } from '../../../entities/base-entity';
import { User } from '../../user/entities/user.entity';

@Entity('user_2fa')
export class User2fa extends BaseEntity {
  @Column({ name: 'user_id', unique: true })
  userId: string;

  @OneToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'encrypted_secret', type: 'text', nullable: true })
  encryptedSecret: string | null;

  @Column({ name: 'pending_secret', type: 'text', nullable: true })
  pendingSecret: string | null;

  @Column({ name: 'pending_expires_at', type: 'timestamptz', nullable: true })
  pendingExpiresAt: Date | null;

  @Column({ name: 'last_used_step', type: 'bigint', nullable: true })
  lastUsedStep: string | null;

  @Column({ name: 'two_fa_enabled', default: false })
  twoFaEnabled: boolean;
}
