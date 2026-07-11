import { Column, Entity, Index, OneToMany, Unique } from 'typeorm';

import { BaseEntity } from '../../../entities/base-entity';
import { LaboratoryOnboardingStatus } from '../enums/laboratory-onboarding-status.enum';
import { LaboratoryVerificationStatus } from '../enums/laboratory-verification-status.enum';

import { LaboratoryAdmin } from './laboratory-admin.entity';

@Unique(['registration_number'])
@Unique(['license_number'])
@Index(['region'])
@Index(['verification_status'])
@Entity('laboratories')
export class Laboratory extends BaseEntity {
  @Column()
  name: string;

  @Column()
  registration_number: string;

  @Column()
  license_number: string;

  @Column({ type: 'text' })
  address: string;

  @Column()
  region: string;

  @Column()
  contact_email: string;

  @Column()
  contact_phone: string;

  @Column({
    type: 'varchar',
    default: LaboratoryVerificationStatus.PENDING,
  })
  verification_status: LaboratoryVerificationStatus;

  @Column({
    type: 'varchar',
    default: LaboratoryOnboardingStatus.LABORATORY_CREATED,
  })
  onboarding_status: LaboratoryOnboardingStatus;

  @Column({ default: true })
  is_active: boolean;

  @OneToMany(() => LaboratoryAdmin, (administrator) => administrator.laboratory)
  administrators: LaboratoryAdmin[];
}
