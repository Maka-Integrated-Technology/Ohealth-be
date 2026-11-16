import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsEmail,
  Matches,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

import { isSecurePassword } from '../password-policy/is-secure-password.decorator';
import { PASSWORD_MIN_LENGTH } from '../password-policy/password-policy';

export class ForgotPasswordDto {
  @ApiProperty({
    example: 'user@example.com',
    description: 'User email address',
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;
}

export class ResetPasswordDto {
  @ApiProperty({
    format: 'uuid',
    description: 'Purpose-bound recovery challenge ID from the recovery email',
  })
  @IsUUID()
  challenge_id: string;

  @ApiProperty({ example: '123456', description: '6-digit recovery code' })
  @IsString()
  @Matches(/^\d{6}$/)
  code: string;

  @ApiProperty({
    example: 'a memorable patient passphrase',
    description: 'New password: 15+ Unicode characters, max 1024 UTF-8 bytes',
    minLength: PASSWORD_MIN_LENGTH,
  })
  @IsString()
  @IsNotEmpty()
  @isSecurePassword()
  newPassword: string;
}
export class RefreshTokenDto {
  @ApiProperty({
    example: '4s0Y1Vv7P4QkFQhp4nHq2dc6_bVdI0kQ6-1pMbx2YpA',
    description: 'Opaque refresh credential',
    pattern: '^[A-Za-z0-9_-]{43}$',
  })
  @IsString()
  @Matches(/^[A-Za-z0-9_-]{43}$/)
  refresh_token: string;
}

export class GoogleLoginDto {
  @ApiProperty({
    example: 'eyJhbGciOiJSUzI1NiIsImtpZCI6IjFj... (Google ID Token)',
    description: 'Google ID Token',
  })
  @IsString()
  @IsNotEmpty()
  token: string;
}

export class VerifySignupDto {
  @ApiProperty({
    format: 'uuid',
    description: 'Purpose-bound contact verification challenge ID',
  })
  @IsUUID()
  challenge_id: string;

  @ApiProperty({
    example: '123456',
    description: '6-digit verification code',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{6}$/)
  code: string;
}

export class LogoutDto {
  @ApiProperty({
    example: 'session-id-123',
    description: 'session id',
  })
  @IsUUID()
  @IsNotEmpty()
  session_id: string;
}

export class UpdateProfileDto {
  @ApiProperty({
    description: 'User first name',
    example: 'John',
    required: false,
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  first_name?: string;

  @ApiProperty({
    description: 'User last name',
    example: 'Doe',
    required: false,
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  last_name?: string;

  @ApiProperty({
    description: 'User middle name',
    example: 'Michael',
    required: false,
    nullable: true,
  })
  @IsOptional()
  @IsString()
  middle_name?: string | null;

  @ApiProperty({
    description: 'User gender',
    example: 'Male',
    enum: ['Male', 'Female', 'Other'],
    required: false,
    nullable: true,
  })
  @IsOptional()
  @IsString()
  gender?: string | null;

  @ApiProperty({
    description: 'Date of birth in YYYY-MM-DD format',
    example: '2000-01-15',
    required: false,
    nullable: true,
  })
  @IsOptional()
  @IsString()
  dob?: string | null;

  @ApiProperty({
    description: 'User phone number',
    example: '+1234567890',
    required: false,
    nullable: true,
  })
  @IsOptional()
  @IsString()
  phone?: string | null;

  @ApiProperty({
    description: 'User country of residence',
    example: 'Nigeria',
    required: false,
    nullable: true,
  })
  @IsOptional()
  @IsString()
  country?: string | null;

  @ApiProperty({
    description: 'User avatar image URL',
    example: 'https://res.cloudinary.com/ohealth/image/upload/v123/avatar.png',
    required: false,
    nullable: true,
  })
  @IsOptional()
  @IsString()
  image?: string | null;
}

export class ChangePasswordDto {
  @ApiProperty({
    description: 'Current password',
    example: 'OldPassword123!',
  })
  @IsString()
  @IsNotEmpty()
  currentPassword: string;

  @ApiProperty({
    description: 'New password: 15+ Unicode characters, max 1024 UTF-8 bytes',
    example: 'a memorable patient passphrase',
    minLength: PASSWORD_MIN_LENGTH,
  })
  @IsString()
  @IsNotEmpty()
  @isSecurePassword()
  newPassword: string;
}
