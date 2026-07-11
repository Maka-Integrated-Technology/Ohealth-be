import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, Matches } from 'class-validator';

export class CreatePharmacyDto {
  @ApiProperty({ example: 'HealthPlus Pharmacy' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'PCN-123456' })
  @IsString()
  @IsNotEmpty()
  registration_number: string;

  @ApiProperty({ example: 'LIC-789012' })
  @IsString()
  @IsNotEmpty()
  license_number: string;

  @ApiProperty({ example: '12 Admiralty Way, Lekki Phase 1, Lagos' })
  @IsString()
  @IsNotEmpty()
  business_address: string;

  @ApiProperty({ example: 'Lagos' })
  @IsString()
  @IsNotEmpty()
  region: string;

  @ApiProperty({ example: 'contact@healthplus.example' })
  @IsEmail()
  @IsNotEmpty()
  contact_email: string;

  @ApiProperty({ example: '+2348012345678' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^[+\d][\d\s().-]{6,24}$/, {
    message: 'contact_phone must be a valid phone number',
  })
  contact_phone: string;
}
