import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';

import { AuthSession } from './auth.entity';

@Entity('auth_refresh_credentials')
export class RefreshCredential {
  @PrimaryColumn({ type: 'varchar', length: 64 })
  token_hash: string;

  @Column()
  session_id: string;

  @ManyToOne(() => AuthSession, (session) => session.refresh_credentials, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'session_id', referencedColumnName: 'session_id' })
  session: AuthSession;

  @Column({
    type: 'timestamp with time zone',
    default: () => 'CURRENT_TIMESTAMP',
  })
  created_at: Date;

  @Column({ type: 'timestamp with time zone', nullable: true })
  consumed_at?: Date | null;
}
