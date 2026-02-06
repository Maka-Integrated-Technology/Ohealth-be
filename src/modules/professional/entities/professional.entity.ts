import { Column, Entity, JoinColumn, ManyToOne, OneToMany, OneToOne } from 'typeorm';

import { BaseEntity } from '../../../entities/base-entity';
import { User } from '../../user/entities/user.entity';
import { Speciality } from '../../speciality/entities/speciality.entity';
import { ProfessionalAvailability } from './professional-availability.entity';
import { Booking } from '../../booking/entities/booking.entity';

export enum ConsultationType {
  CHAT = 'chat',
  VIDEO = 'video',
  BOTH = 'both',
}

@Entity('professionals')
export class Professional extends BaseEntity {
  @OneToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'user_id' })
  user_id: string;

  @ManyToOne(() => Speciality, (speciality) => speciality.professionals)
  @JoinColumn({ name: 'speciality_id' })
  speciality: Speciality;

  @Column({ name: 'speciality_id' })
  speciality_id: string;

  @Column({ nullable: true })
  image?: string;

  @Column({ type: 'text', nullable: true })
  about?: string;

  @Column({ type: 'int', default: 0 })
  years_of_experience: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  consultation_fee: number;

  @Column({ type: 'decimal', precision: 3, scale: 2, default: 0 })
  rating: number;

  @Column({ type: 'int', default: 0 })
  total_reviews: number;

  @Column({
    type: 'enum',
    enum: ConsultationType,
    default: ConsultationType.BOTH,
  })
  consultation_type: ConsultationType;

  @Column({ default: true })
  is_available: boolean;

  @Column({ default: true })
  is_active: boolean;

  @OneToMany(() => ProfessionalAvailability, (availability) => availability.professional)
  availabilities: ProfessionalAvailability[];

  @OneToMany(() => Booking, (booking) => booking.professional)
  bookings: Booking[];
}
