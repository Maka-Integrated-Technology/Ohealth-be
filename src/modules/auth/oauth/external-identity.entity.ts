import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

import { User } from '../../user/entities/user.entity';

import { OAuthProvider } from './oauth.enums';

@Check('CHK_external_identities_provider', `"provider" IN ('google')`)
@Check(
  'CHK_external_identities_issuer',
  `"issuer" = 'https://accounts.google.com'`,
)
@Unique('UQ_external_identities_issuer_subject', ['issuer', 'subject'])
@Unique('UQ_external_identities_user_provider', ['user_id', 'provider'])
@Index('IDX_external_identities_user_id', ['user_id'])
@Entity('external_identities')
export class ExternalIdentity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'user_id',
    foreignKeyConstraintName: 'FK_external_identities_user_id',
  })
  user: User;

  @Column({ type: 'uuid' })
  user_id: string;

  @Column({ type: 'varchar' })
  provider: OAuthProvider;

  @Column({ type: 'varchar' })
  issuer: string;

  @Column({ type: 'varchar' })
  subject: string;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  linked_at: Date;

  @Column({ type: 'timestamp with time zone', nullable: true })
  last_authenticated_at: Date | null;
}
