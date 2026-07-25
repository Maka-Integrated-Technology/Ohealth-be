import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEmail,
  IsNotEmpty,
  IsString,
  Matches,
  MinLength,
  ValidateNested,
} from 'class-validator';

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

  @ApiProperty({ example: 'SecurePassword123', minLength: 8 })
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  @Matches(/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
    message:
      'password must contain at least one uppercase letter, one lowercase letter, and one number',
  })
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
