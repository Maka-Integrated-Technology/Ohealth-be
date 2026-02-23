import { Column, Entity, OneToMany } from 'typeorm';

import { BaseEntity } from '../../../entities/base-entity';
import { Professional } from '../../professional/entities/professional.entity';

@Entity('specialities')
export class Speciality extends BaseEntity {
  @Column({ unique: true })
  name: string;

  @Column({ nullable: true })
  description?: string;

  @Column({ nullable: true })
  icon?: string;

  @Column({ default: true })
  is_active: boolean;

  @OneToMany(() => Professional, (professional) => professional.speciality)
  professionals: Professional[];
}
