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
import { DayOfWeek } from '../enums/laboratory-post-approval.enum';

@Unique('UQ_laboratory_operating_hours_organization_day', [
  'organization_id',
  'day_of_week',
])
@Check(
  'CHK_laboratory_operating_hours_schedule',
  `("is_closed" = true AND "opens_at" IS NULL AND "closes_at" IS NULL)
    OR
   ("is_closed" = false AND "opens_at" IS NOT NULL AND "closes_at" IS NOT NULL AND "opens_at" < "closes_at")`,
)
@Check(
  'CHK_laboratory_operating_hours_day',
  `"day_of_week" IN ('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday')`,
)
@Index('IDX_laboratory_operating_hours_organization_id', ['organization_id'])
@Entity('laboratory_operating_hours')
export class LaboratoryOperatingHour extends BaseEntity {
  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'organization_id',
    foreignKeyConstraintName: 'FK_laboratory_operating_hours_organization_id',
  })
  organization: Organization;

  @Column({ type: 'uuid' })
  organization_id: string;

  @Column({ type: 'varchar' })
  day_of_week: DayOfWeek;

  @Column({ type: 'time', nullable: true })
  opens_at: string | null;

  @Column({ type: 'time', nullable: true })
  closes_at: string | null;

  @Column({ default: false })
  is_closed: boolean;
}
