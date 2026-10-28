import { Check, Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export enum AuthChallengePurpose {
  CONTACT_VERIFICATION = 'contact_verification',
  PASSWORD_RECOVERY = 'password_recovery',
}

@Index('IDX_auth_challenges_subject_issued', [
  'subject_user_id',
  'purpose',
  'issued_at',
])
@Check(
  'CHK_auth_challenge_purpose',
  `"purpose" IN ('contact_verification', 'password_recovery')`,
)
@Check(
  'CHK_auth_challenge_attempts',
  '"attempt_count" >= 0 AND "attempt_count" <= 5',
)
@Check('CHK_auth_challenge_expiry', '"expires_at" > "issued_at"')
@Entity('auth_challenges')
export class AuthChallenge {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  purpose: AuthChallengePurpose;

  @Column({ type: 'uuid' })
  subject_user_id: string;

  @Column({ type: 'char', length: 64 })
  secret_hash: string;

  @Column({ type: 'timestamp with time zone', default: () => 'now()' })
  issued_at: Date;

  @Column({ type: 'timestamp with time zone' })
  expires_at: Date;

  @Column({ type: 'int', default: 0 })
  attempt_count: number;

  @Column({ type: 'timestamp with time zone', nullable: true })
  consumed_at: Date | null;
}
