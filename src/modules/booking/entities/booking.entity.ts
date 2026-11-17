import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';

import { BaseEntity } from '../../../entities/base-entity';
import { ProfessionalAvailability } from '../../professional/entities/professional-availability.entity';
import { Professional } from '../../professional/entities/professional.entity';
import { User } from '../../user/entities/user.entity';

export enum BookingStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

export enum ConsultationType {
  CHAT = 'chat',
  VIDEO = 'video',
}

@Index(['professional_id', 'booking_date', 'booking_time'])
@Index('IDX_bookings_availability_id', ['availability_id'])
// A slot is held by at most one booking that is not cancelled. Cancelled
// bookings keep their link as history, so the slot can be booked again.
@Index('UQ_bookings_active_availability', ['availability_id'], {
  unique: true,
  where: `"status" <> 'cancelled'`,
})
@Entity('bookings')
export class Booking extends BaseEntity {
  @ManyToOne(() => User)
  @JoinColumn({ name: 'patient_id' })
  patient: User;

  @Column({ name: 'patient_id' })
  patient_id: string;

  @ManyToOne(() => Professional, (professional) => professional.bookings)
  @JoinColumn({ name: 'professional_id' })
  professional: Professional;

  @Column({ name: 'professional_id' })
  professional_id: string;

  @Column({ type: 'date' })
  booking_date: string;

  @Column({ type: 'time' })
  booking_time: string;

  @Column({
    type: 'enum',
    enum: ConsultationType,
  })
  consultation_type: ConsultationType;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount: number;

  @Column({
    type: 'enum',
    enum: BookingStatus,
    default: BookingStatus.PENDING,
  })
  status: BookingStatus;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @Column({ nullable: true })
  payment_reference?: string;

  @Column({ default: false })
  is_paid: boolean;

  /**
   * Links back to the specific availability slot so we can restore it
   * when the booking is cancelled.  Null for bookings created before
   * this column was added. A slot keeps the links of its cancelled
   * bookings, so it can have several bookings but only one active one.
   */
  @ManyToOne(() => ProfessionalAvailability, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'availability_id' })
  availability?: ProfessionalAvailability;

  @Column({ name: 'availability_id', nullable: true })
  availability_id?: string;
}
