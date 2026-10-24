import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { AccountStatus } from '../enums/account-status.enum';

@Entity('user_account_status_history')
export class UserAccountStatusHistory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  user_id: string;

  @Column({ type: 'varchar', nullable: true })
  previous_status: AccountStatus | null;

  @Column({ type: 'varchar' })
  new_status: AccountStatus;

  @Column({ type: 'uuid', nullable: true })
  changed_by_user_id: string | null;

  @Column({ type: 'text' })
  reason: string;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  changed_at: Date;
}
