import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDefined,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

import { OrganizationType } from '../enums/organization-type.enum';

export class OrganizationDetailsDto {
  @ApiProperty({ enum: OrganizationType })
  @IsEnum(OrganizationType)
  organization_type: OrganizationType;

  @ApiProperty({ example: 'MedCheck Diagnostics' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  @ApiProperty({ example: 'RC-123456' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  registration_number: string;

  @ApiProperty({ example: '12 Admiralty Way, Lekki, Lagos' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  location: string;

  @ApiProperty({ example: 'contact@organization.example' })
  @IsEmail()
  @MaxLength(254)
  contact_email: string;

  @ApiPropertyOptional({ example: '+2348012345678' })
  @IsOptional()
  @IsString()
  @Matches(/^\+?[0-9\s().-]{7,20}$/, {
    message: 'contact_phone must be a valid phone number',
  })
  contact_phone?: string;
}

export class OrganizationAdministratorDto {
  @ApiProperty({ example: 'Tunde Adebayo' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  full_name: string;

  @ApiProperty({ example: 'tunde@organization.example' })
  @IsEmail()
  @MaxLength(254)
  email: string;

  @ApiProperty({ example: '+2348098765432' })
  @IsString()
  @Matches(/^\+?[0-9\s().-]{7,20}$/, {
    message: 'phone must be a valid phone number',
  })
  phone: string;

  @ApiProperty({ example: 'SecurePassword123', minLength: 8 })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  @Matches(/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
    message:
      'password must contain at least one uppercase letter, one lowercase letter, and one number',
  })
  password: string;
}

export class SetupOrganizationDto {
  @ApiProperty({ type: OrganizationDetailsDto })
  @IsDefined()
  @ValidateNested()
  @Type(() => OrganizationDetailsDto)
  organization: OrganizationDetailsDto;

  @ApiProperty({ type: OrganizationAdministratorDto })
  @IsDefined()
  @ValidateNested()
  @Type(() => OrganizationAdministratorDto)
  administrator: OrganizationAdministratorDto;
}
