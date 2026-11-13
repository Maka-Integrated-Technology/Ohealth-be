import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { SignupIntent } from '../enums/signup-intent.enum';

import { OAuthConsumer, OAuthOperation, OAuthProvider } from './oauth.enums';

@Index('IDX_oauth_transactions_expiry', ['expires_at'])
@Check('CHK_oauth_transactions_provider', `"provider" IN ('google')`)
@Check(
  'CHK_oauth_transactions_operation',
  `"operation" IN ('signup', 'signin', 'link')`,
)
@Check('CHK_oauth_transactions_consumer', `"consumer" IN ('web', 'mobile')`)
@Entity('oauth_transactions')
export class OAuthTransaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  provider: OAuthProvider;

  @Column({ type: 'varchar' })
  operation: OAuthOperation;

  @Column({ type: 'varchar' })
  consumer: OAuthConsumer;

  @Column({ type: 'varchar' })
  audience: string;

  @Column({ type: 'char', length: 64 })
  transaction_token_hash: string;

  @Column({ type: 'char', length: 64 })
  nonce_hash: string;

  @Column({ type: 'varchar', nullable: true })
  intent: SignupIntent | null;

  @Column({ type: 'varchar', nullable: true })
  accepted_terms_version: string | null;

  @Column({ type: 'varchar', nullable: true })
  accepted_privacy_version: string | null;

  @Column({ type: 'uuid', nullable: true })
  user_id: string | null;

  @Column({ type: 'varchar', nullable: true })
  session_id: string | null;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  created_at: Date;

  @Column({ type: 'timestamp with time zone' })
  expires_at: Date;

  @Column({ type: 'timestamp with time zone', nullable: true })
  consumed_at: Date | null;
}
