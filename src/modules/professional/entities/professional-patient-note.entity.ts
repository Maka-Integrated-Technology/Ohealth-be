import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';

import { BaseEntity } from '../../../entities/base-entity';
import { User } from '../../user/entities/user.entity';

import { Professional } from './professional.entity';

@Index(['professional_id', 'patient_id', 'created_at'])
@Entity('professional_patient_notes')
export class ProfessionalPatientNote extends BaseEntity {
  @ManyToOne(() => Professional, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'professional_id' })
  professional: Professional;

  @Column({ name: 'professional_id' })
  professional_id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'patient_id' })
  patient: User;

  @Column({ name: 'patient_id' })
  patient_id: string;

  @Column({ type: 'text' })
  content: string;
}
