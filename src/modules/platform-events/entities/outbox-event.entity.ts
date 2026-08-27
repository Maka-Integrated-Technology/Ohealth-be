import { Check, Column, Entity, Index } from 'typeorm';

import { BaseEntity } from '../../../entities/base-entity';
import { OutboxEventStatus } from '../enums/outbox-event-status.enum';

@Index('IDX_outbox_events_dispatch', ['status', 'available_at'])
@Check(
  'CHK_outbox_events_status',
  `"status" IN ('pending', 'processing', 'published', 'failed')`,
)
@Check('CHK_outbox_events_attempts', `"attempts" >= 0`)
@Check('CHK_outbox_events_payload', `jsonb_typeof("payload") = 'object'`)
@Entity('outbox_events')
export class OutboxEvent extends BaseEntity {
  @Column({ type: 'varchar' })
  aggregate_type: string;

  @Column({ type: 'uuid', nullable: true })
  aggregate_id?: string | null;

  @Column({ type: 'varchar' })
  event_type: string;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  payload: Record<string, unknown>;

  @Column({ type: 'varchar', default: OutboxEventStatus.PENDING })
  status: OutboxEventStatus;

  @Column({ type: 'int', default: 0 })
  attempts: number;

  @Column({ type: 'timestamp with time zone', default: () => 'now()' })
  available_at: Date;

  @Column({ type: 'timestamp with time zone', nullable: true })
  processed_at?: Date | null;

  @Column({ type: 'text', nullable: true })
  last_error?: string | null;
}
