import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDefined,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsString,
  MaxLength,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

import { SignupIntent } from '../enums/signup-intent.enum';

import { OrganizationRegistrationDto } from './organization-registration.dto';

export class RegisterAccountDto {
  @ApiProperty({ example: 'Ada' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  first_name: string;

  @ApiProperty({ example: 'Okafor' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  last_name: string;

  @ApiProperty({ format: 'email', example: 'ada@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ format: 'password', minLength: 12, maxLength: 128 })
  @IsString()
  @MinLength(12)
  @MaxLength(128)
  password: string;

  @ApiProperty({ enum: SignupIntent })
  @IsEnum(SignupIntent)
  intent: SignupIntent;

  @ApiProperty({ example: '2026-08-01' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  accepted_terms_version: string;

  @ApiProperty({ example: '2026-08-01' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  accepted_privacy_version: string;

  @ApiPropertyOptional({ type: OrganizationRegistrationDto })
  @ValidateIf(
    (dto: RegisterAccountDto) => dto.intent === SignupIntent.ORGANIZATION,
  )
  @IsDefined()
  @ValidateNested()
  @Type(() => OrganizationRegistrationDto)
  organization?: OrganizationRegistrationDto;
}
