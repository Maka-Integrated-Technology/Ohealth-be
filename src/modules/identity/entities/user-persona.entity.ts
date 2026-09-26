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
import { User } from '../../user/entities/user.entity';
import { UserPersonaType } from '../enums/user-persona-type.enum';

@Unique('UQ_user_personas_user_type', ['user_id', 'persona_type'])
@Index('IDX_user_personas_user_id', ['user_id'])
@Check(
  'CHK_user_personas_type',
  `"persona_type" IN ('patient', 'healthcare_professional')`,
)
@Entity('user_personas')
export class UserPersona extends BaseEntity {
  @ManyToOne(() => User, (user) => user.personas, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'user_id',
    foreignKeyConstraintName: 'FK_user_personas_user_id',
  })
  user: User;

  @Column({ type: 'uuid' })
  user_id: string;

  @Column({ type: 'varchar' })
  persona_type: UserPersonaType;

  @Column({ default: true })
  is_active: boolean;
}
