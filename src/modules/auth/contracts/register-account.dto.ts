import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDefined,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsString,
  MaxLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

import { SignupIntent } from '../enums/signup-intent.enum';
import { isSecurePassword } from '../password-policy/is-secure-password.decorator';
import { PASSWORD_MIN_LENGTH } from '../password-policy/password-policy';

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

  @ApiProperty({
    format: 'password',
    minLength: PASSWORD_MIN_LENGTH,
    description:
      '15+ Unicode characters, no composition rule, max 1024 UTF-8 bytes',
  })
  @IsString()
  @isSecurePassword()
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
