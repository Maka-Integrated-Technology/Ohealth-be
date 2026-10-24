import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';

import { AuthSession } from './auth.entity';

/** Retain consumed verifiers until the family's absolute expiry for replay detection. */
@Entity('auth_refresh_credentials')
export class RefreshCredential {
  @PrimaryColumn({ type: 'varchar', length: 64 })
  token_hash: string;

  @Column()
  session_id: string;

  @ManyToOne(() => AuthSession, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'session_id', referencedColumnName: 'session_id' })
  session: AuthSession;

  @Column({ type: 'timestamptz' })
  created_at: Date;

  @Column({ type: 'timestamptz', nullable: true })
  consumed_at: Date | null;
}
