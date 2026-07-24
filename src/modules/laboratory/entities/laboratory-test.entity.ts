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
import { Organization } from '../../organization/entities/organization.entity';

@Unique('UQ_laboratory_tests_organization_normalized_name', [
  'organization_id',
  'normalized_name',
])
@Check('CHK_laboratory_tests_price', '"price" >= 0')
@Check('CHK_laboratory_tests_turnaround_time', '"turnaround_time_minutes" > 0')
@Index('IDX_laboratory_tests_organization_id', ['organization_id'])
@Entity('laboratory_tests')
export class LaboratoryTest extends BaseEntity {
  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'organization_id',
    foreignKeyConstraintName: 'FK_laboratory_tests_organization_id',
  })
  organization: Organization;

  @Column({ type: 'uuid' })
  organization_id: string;

  @Column()
  name: string;

  @Column()
  normalized_name: string;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  price: number;

  @Column({ type: 'integer' })
  turnaround_time_minutes: number;

  @Column({ default: true })
  is_active: boolean;
}
