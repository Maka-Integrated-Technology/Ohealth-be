import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

import {
  AuthSecurityEventOutcome,
  AuthSecurityEventType,
  AuthSecurityRequestSource,
} from './auth-security-event.enum';

@Index('IDX_auth_security_events_subject_time', [
  'subject_user_id',
  'occurred_at',
])
@Index('IDX_auth_security_events_type_time', ['event_type', 'occurred_at'])
@Check(
  'CHK_auth_security_events_type',
  `"event_type" IN ('sign_in', 'contact_verification', 'password_recovery', 'password_change', 'session_refresh', 'session_reuse', 'logout', 'account_state_change', 'oauth_link', 'registration', 'mfa')`,
)
@Check(
  'CHK_auth_security_events_outcome',
  `"outcome" IN ('succeeded', 'denied', 'failed')`,
)
@Check(
  'CHK_auth_security_events_source',
  `"request_source" IN ('web', 'mobile', 'api', 'unknown')`,
)
@Entity('auth_security_events')
export class AuthSecurityEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  event_type: AuthSecurityEventType;

  @Column({ type: 'varchar' })
  outcome: AuthSecurityEventOutcome;

  // Intentionally nullable: failed sign-in must not identify whether an email exists.
  // No cascading user FK: deletion cannot erase security event history.
  @Column({ type: 'uuid', nullable: true })
  actor_user_id: string | null;

  @Column({ type: 'uuid', nullable: true })
  subject_user_id: string | null;

  @Column({ type: 'uuid', nullable: true })
  session_id: string | null;

  @Column({ type: 'varchar', default: AuthSecurityRequestSource.UNKNOWN })
  request_source: AuthSecurityRequestSource;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  occurred_at: Date;
}
