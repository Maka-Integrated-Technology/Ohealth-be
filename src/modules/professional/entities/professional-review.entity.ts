import {
  Check,
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToOne,
} from 'typeorm';

import { BaseEntity } from '../../../entities/base-entity';
import { Booking } from '../../booking/entities/booking.entity';
import { User } from '../../user/entities/user.entity';

import { Professional } from './professional.entity';

@Entity('professional_reviews')
@Index(['professional_id'])
export class ProfessionalReview extends BaseEntity {
  /** The user who wrote the review (typically the patient). */
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'reviewer_id' })
  reviewer: User;

  @Column({ name: 'reviewer_id' })
  reviewer_id: string;

  /** The professional being reviewed. */
  @ManyToOne(() => Professional, (p) => p.reviews, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'professional_id' })
  professional: Professional;

  @Column({ name: 'professional_id' })
  professional_id: string;

  /**
   * Optional: the booking this review belongs to.
   * Unique: one review per booking to prevent duplicate submissions.
   */
  @OneToOne(() => Booking, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'booking_id' })
  booking?: Booking;

  @Column({ name: 'booking_id', nullable: true, unique: true })
  booking_id?: string;

  /** Star rating 1–5. */
  @Column({ type: 'smallint' })
  @Check('"rating" >= 1 AND "rating" <= 5')
  rating: number;

  @Column({ type: 'text', nullable: true })
  comment?: string;
}
