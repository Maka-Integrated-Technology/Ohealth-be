import { Column, Entity, Index, Unique } from 'typeorm';

import { BaseEntity } from '../../../entities/base-entity';

export enum PharmacyVerificationStatus {
  SUBMITTED = 'submitted',
  UNDER_REVIEW = 'under_review',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

@Unique(['registration_number'])
@Unique(['license_number'])
@Index(['region'])
@Index(['verification_status'])
@Entity('pharmacies')
export class Pharmacy extends BaseEntity {
  @Column()
  name: string;

  @Column()
  registration_number: string;

  @Column()
  license_number: string;

  @Column({ type: 'text' })
  business_address: string;

  @Column()
  region: string;

  @Column()
  contact_email: string;

  @Column()
  contact_phone: string;

  @Column({
    type: 'enum',
    enum: PharmacyVerificationStatus,
    default: PharmacyVerificationStatus.SUBMITTED,
  })
  verification_status: PharmacyVerificationStatus;

  @Column({ default: true })
  is_active: boolean;
}
