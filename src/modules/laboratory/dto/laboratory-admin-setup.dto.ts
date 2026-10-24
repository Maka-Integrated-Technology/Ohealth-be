import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEmail,
  IsNotEmpty,
  IsString,
  Matches,
  ValidateNested,
} from 'class-validator';

import { isSecurePassword } from '../../auth/password-policy/is-secure-password.decorator';
import { PASSWORD_MIN_LENGTH } from '../../auth/password-policy/password-policy';

export class LaboratorySetupDto {
  @ApiProperty({ example: 'MedCheck Diagnostics' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'RC-123456' })
  @IsString()
  @IsNotEmpty()
  registration_number: string;

  @ApiProperty({ example: 'LAB-987654' })
  @IsString()
  @IsNotEmpty()
  license_number: string;

  @ApiProperty({ example: '12 Admiralty Way, Lekki, Lagos' })
  @IsString()
  @IsNotEmpty()
  address: string;

  @ApiProperty({ example: 'Lagos' })
  @IsString()
  @IsNotEmpty()
  region: string;

  @ApiProperty({ example: 'hello@medcheck.example' })
  @IsEmail()
  @IsNotEmpty()
  contact_email: string;

  @ApiProperty({ example: '+2348012345678' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\+?[0-9\s().-]{7,20}$/, {
    message: 'contact_phone must be a valid phone number',
  })
  contact_phone: string;
}

export class LaboratoryAdministratorSetupDto {
  @ApiProperty({ example: 'Tunde Adebayo' })
  @IsString()
  @IsNotEmpty()
  full_name: string;

  @ApiProperty({ example: 'tunde@medcheck.example' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ example: '+2348098765432' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\+?[0-9\s().-]{7,20}$/, {
    message: 'phone must be a valid phone number',
  })
  phone: string;

  @ApiProperty({
    example: 'a memorable patient passphrase',
    minLength: PASSWORD_MIN_LENGTH,
  })
  @IsString()
  @IsNotEmpty()
  @isSecurePassword()
  password: string;
}

export class LaboratoryAdminSetupDto {
  @ApiProperty({ type: LaboratorySetupDto })
  @ValidateNested()
  @Type(() => LaboratorySetupDto)
  laboratory: LaboratorySetupDto;

  @ApiProperty({ type: LaboratoryAdministratorSetupDto })
  @ValidateNested()
  @Type(() => LaboratoryAdministratorSetupDto)
  administrator: LaboratoryAdministratorSetupDto;
}
