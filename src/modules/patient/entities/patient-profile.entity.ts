import { Column, Entity, Index, JoinColumn, OneToOne, Unique } from 'typeorm';

import { BaseEntity } from '../../../entities/base-entity';
import { User } from '../../user/entities/user.entity';

@Unique(['user_id'])
@Index(['patient_reference'])
@Entity('patient_profiles')
export class PatientProfile extends BaseEntity {
  @OneToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'user_id' })
  user_id: string;

  @Column({ nullable: true })
  patient_reference?: string | null;

  @Column({ type: 'simple-array', nullable: true })
  medical_conditions?: string[] | null;

  @Column({ type: 'simple-array', nullable: true })
  allergies?: string[] | null;

  @Column({ nullable: true })
  blood_group?: string | null;

  @Column({ nullable: true })
  emergency_contact_name?: string | null;

  @Column({ nullable: true })
  emergency_contact_phone?: string | null;
}
