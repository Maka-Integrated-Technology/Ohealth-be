import { ApiProperty } from '@nestjs/swagger';

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

export class AuthContextResponseDto {
  @ApiProperty({ type: Object })
  account: Record<string, unknown>;

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
