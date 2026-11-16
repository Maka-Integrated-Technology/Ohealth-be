import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('mfa_recovery_codes')
@Index('IDX_mfa_recovery_user', ['userId'])
export class MfaRecoveryCode {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'code_hash', type: 'char', length: 64, unique: true })
  codeHash: string;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' })
  createdAt: Date;
}
