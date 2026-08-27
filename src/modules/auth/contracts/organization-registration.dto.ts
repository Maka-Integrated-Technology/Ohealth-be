import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

import { OrganizationType } from '../../organization/enums/organization-type.enum';

export class OrganizationRegistrationDto {
  @ApiProperty({ enum: OrganizationType })
  @IsEnum(OrganizationType)
  organization_type: OrganizationType;

  @ApiProperty({ example: 'OHealth Medical Centre' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  name: string;

  @ApiProperty({ example: 'RC-123456' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  registration_number: string;

  @ApiProperty({ example: '12 Adeola Odeku Street, Lagos' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  location: string;

  @ApiProperty({ format: 'email', example: 'operations@example.com' })
  @IsEmail()
  contact_email: string;

  @ApiPropertyOptional({ example: '+2348012345678' })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  contact_phone?: string;
}
