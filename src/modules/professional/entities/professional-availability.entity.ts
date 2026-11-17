import {
  Check,
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  Unique,
} from 'typeorm';

import { BaseEntity } from '../../../entities/base-entity';
import {
  AVAILABILITY_TIME_ZONE_MAX_LENGTH,
  PLATFORM_SCHEDULING_TIME_ZONE,
} from '../professional-availability.constants';

import { Professional } from './professional.entity';

/** Prevents two identical slots for the same professional on the same day. */
@Unique(['professional_id', 'date', 'start_time'])
@Index(['professional_id', 'date', 'start_time'])
@Check(
  'CHK_professional_availabilities_time_zone',
  `"time_zone" ~ '^[A-Za-z]+(/[A-Za-z0-9_+-]+)+$' AND (("date" + "start_time") AT TIME ZONE "time_zone") IS NOT NULL`,
)
@Entity('professional_availabilities')
export class ProfessionalAvailability extends BaseEntity {
  @ManyToOne(() => Professional, (professional) => professional.availabilities)
  @JoinColumn({ name: 'professional_id' })
  professional: Professional;

  @Column({ name: 'professional_id' })
  professional_id: string;

  @Column({ type: 'date' })
  date: string;

  @Column({ type: 'time' })
  start_time: string;

  @Column({ type: 'time' })
  end_time: string;

  /**
   * IANA time zone the date and times of this slot are local to. The instant
   * a slot starts is always derived from this value, never from the zone of
   * the server that reads it.
   */
  @Column({
    type: 'varchar',
    length: AVAILABILITY_TIME_ZONE_MAX_LENGTH,
    default: PLATFORM_SCHEDULING_TIME_ZONE,
  })
  time_zone: string;

  @Column({ default: true })
  is_available: boolean;
}
