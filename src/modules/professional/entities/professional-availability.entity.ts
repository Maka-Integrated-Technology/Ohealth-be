import { Column, Entity, Index, JoinColumn, ManyToOne, Unique } from 'typeorm';

import { BaseEntity } from '../../../entities/base-entity';

import { Professional } from './professional.entity';

/** Prevents two identical slots for the same professional on the same day. */
@Unique(['professional_id', 'date', 'start_time'])
@Index(['professional_id', 'date', 'start_time'])
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

  @Column({ default: true })
  is_available: boolean;
}
