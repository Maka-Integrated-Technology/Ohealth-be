import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToOne,
  Unique,
} from 'typeorm';

import { BaseEntity } from '../../../entities/base-entity';
import { User } from '../../user/entities/user.entity';

import { Laboratory } from './laboratory.entity';

@Unique(['user_id'])
@Unique(['laboratory_id', 'user_id'])
@Index(['laboratory_id'])
@Entity('laboratory_admins')
export class LaboratoryAdmin extends BaseEntity {
  @ManyToOne(() => Laboratory, (laboratory) => laboratory.administrators, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'laboratory_id' })
  laboratory: Laboratory;

  @Column({ name: 'laboratory_id' })
  laboratory_id: string;

  @OneToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'user_id' })
  user_id: string;

  @Column()
  full_name: string;

  @Column()
  phone: string;

  @Column({ default: true })
  is_primary: boolean;
}
