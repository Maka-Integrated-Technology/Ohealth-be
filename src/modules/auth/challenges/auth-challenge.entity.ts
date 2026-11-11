import { Check, Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export enum AuthChallengePurpose {
  CONTACT_VERIFICATION = 'contact_verification',
  PASSWORD_RECOVERY = 'password_recovery',
  LOGIN_VERIFICATION = 'login_verification',
}

export enum AuthChallengeTerminalReason {
  VERIFIED = 'verified',
  SUPERSEDED = 'superseded',
  ATTEMPTS_EXHAUSTED = 'attempts_exhausted',
  ADMINISTRATIVELY_REVOKED = 'administratively_revoked',
  LEGACY_CONSUMED = 'legacy_consumed',
}

@Index('IDX_auth_challenges_subject_issued', [
  'subject_user_id',
  'purpose',
  'issued_at',
])
@Check(
  'CHK_auth_challenge_purpose',
  `"purpose" IN ('contact_verification', 'password_recovery', 'login_verification')`,
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

  @Column({ type: 'uuid' })
  lineage_id: string;

  @Column({ type: 'uuid', nullable: true })
  replaced_by_challenge_id: string | null;

  @Column({ type: 'varchar', nullable: true })
  terminal_reason: AuthChallengeTerminalReason | null;

  @Column({ type: 'int', default: 0 })
  replacement_count: number;

  @Column({ type: 'timestamp with time zone' })
  flow_expires_at: Date;

  @Column({ type: 'timestamp with time zone', nullable: true })
  consumed_at: Date | null;
}
