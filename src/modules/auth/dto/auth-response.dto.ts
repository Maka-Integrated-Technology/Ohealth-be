import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { AuthChallengeContinuationDto } from '../contracts/auth-contract-response.dto';

export class TokensDto {
  @ApiProperty({
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    description: 'JWT access token with 15 minutes expiration',
  })
  access_token: string;

  @ApiProperty({
    example: '4s0Y1Vv7P4QkFQhp4nHq2dc6_bVdI0kQ6-1pMbx2YpA',
    description: 'Opaque, rotating refresh credential',
  })
  refresh_token: string;
}

export class AuthAccountProfileResponseDto {
  @ApiPropertyOptional({ nullable: true, maxLength: 100 })
  middle_name: string | null;

  @ApiPropertyOptional({ nullable: true, enum: ['Male', 'Female', 'Other'] })
  gender: string | null;

  @ApiPropertyOptional({ nullable: true, format: 'date' })
  dob: string | null;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Read-only contact data',
  })
  phone: string | null;

  @ApiPropertyOptional({ nullable: true, maxLength: 100 })
  country: string | null;

  @ApiPropertyOptional({ nullable: true, maxLength: 500 })
  address: string | null;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Read-only avatar URL managed by the photo workflow',
  })
  image: string | null;

  @ApiProperty({ format: 'date-time' })
  updated_at: Date;
}

export class AuthAccountResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'email', readOnly: true })
  email: string;

  @ApiProperty({ maxLength: 100 })
  first_name: string;

  @ApiProperty({ maxLength: 100 })
  last_name: string;

  @ApiProperty({
    enum: ['pending_verification', 'active', 'suspended', 'deactivated'],
    readOnly: true,
  })
  status: string;

  @ApiProperty({ readOnly: true })
  email_verified: boolean;

  @ApiProperty({ format: 'date-time', readOnly: true })
  created_at: Date;

  @ApiProperty({ type: AuthAccountProfileResponseDto })
  profile: AuthAccountProfileResponseDto;
}

export class AuthContextResponseDto {
  @ApiProperty({ type: AuthAccountResponseDto })
  account: AuthAccountResponseDto;

  @ApiProperty({ type: [Object] })
  personas: Array<Record<string, unknown>>;

  @ApiProperty({ type: Object, nullable: true })
  professional: Record<string, unknown> | null;

  @ApiProperty({ type: [Object] })
  memberships: Array<Record<string, unknown>>;

  @ApiProperty({ type: [String] })
  capabilities: string[];

  @ApiProperty({ type: Object })
  session: Record<string, unknown>;
}

export class CanonicalAuthResponseDto extends TokensDto {
  @ApiProperty({
    type: Object,
    description:
      'Server-resolved account, persona, membership, verification, and capability context',
  })
  account_context: Record<string, unknown>;
}

export class LoginResponseDto extends CanonicalAuthResponseDto {
  @ApiProperty({
    example: 200,
    nullable: true,
  })
  status_code?: number;

  @ApiProperty({
    example: 'Login success',
    nullable: true,
  })
  message?: string;

  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    nullable: true,
  })
  session_id?: string;

  @ApiProperty({
    example: '2024-01-15T10:30:00Z',
    nullable: true,
  })
  session_expires_at?: Date;
}

export class LoginChallengeResponseDto extends AuthChallengeContinuationDto {}

export class VerifySignupResponseDto extends LoginResponseDto {
  @ApiProperty({ example: 'account verified' })
  message: string;
}

export class RefreshTokenResponseDto extends CanonicalAuthResponseDto {
  @ApiProperty({
    example: 200,
    nullable: true,
  })
  status_code?: number;

  @ApiProperty({
    example: 'Token refresh successful',
    nullable: true,
  })
  message?: string;

  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  session_id: string;

  @ApiProperty({
    example: '2024-01-15T10:30:00Z',
  })
  session_expires_at: Date;
}
export class LogoutResponseDto {
  @ApiProperty({
    example: 200,
    nullable: true,
  })
  status_code?: number;

  @ApiProperty({
    example: 'logout success',
    nullable: true,
  })
  message?: string;
}
