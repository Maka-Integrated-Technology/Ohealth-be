import { ApiProperty } from '@nestjs/swagger';

import { PharmacyVerificationStatus } from '../entities/pharmacy.entity';

export class PharmacyResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  registration_number: string;

  @ApiProperty()
  license_number: string;

  @ApiProperty()
  business_address: string;

  @ApiProperty()
  region: string;

  @ApiProperty()
  contact_email: string;

  @ApiProperty()
  contact_phone: string;

  @ApiProperty({ enum: PharmacyVerificationStatus })
  verification_status: PharmacyVerificationStatus;

  @ApiProperty()
  is_active: boolean;

  @ApiProperty()
  created_at: Date;

  @ApiProperty()
  updated_at: Date;
}
