import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsString, Matches } from 'class-validator';

const TrimString = () =>
  Transform(({ value }) => (typeof value === 'string' ? value.trim() : value));

export class CreatePharmacyDto {
  @ApiProperty({ example: 'HealthPlus Pharmacy' })
  @TrimString()
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'PCN-123456' })
  @TrimString()
  @IsString()
  @IsNotEmpty()
  registration_number: string;

  @ApiProperty({ example: 'LIC-789012' })
  @TrimString()
  @IsString()
  @IsNotEmpty()
  license_number: string;

  @ApiProperty({ example: '12 Admiralty Way, Lekki Phase 1, Lagos' })
  @TrimString()
  @IsString()
  @IsNotEmpty()
  business_address: string;

  @ApiProperty({ example: 'Lagos' })
  @TrimString()
  @IsString()
  @IsNotEmpty()
  region: string;

  @ApiProperty({ example: 'contact@healthplus.example' })
  @TrimString()
  @IsEmail()
  @IsNotEmpty()
  contact_email: string;

  @ApiProperty({ example: '+2348012345678' })
  @TrimString()
  @IsString()
  @IsNotEmpty()
  @Matches(/^[+\d][\d\s().-]{6,24}$/, {
    message: 'contact_phone must be a valid phone number',
  })
  contact_phone: string;
}
