import { ApiProperty } from '@nestjs/swagger';

import { UserRole } from '../../user/enums/user-role.enum';
import { AuthAccessLevel, AuthRoutingTarget } from '../enums/auth-routing.enum';

class UserDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  id: string;

  @ApiProperty({ example: 'john.doe@example.com' })
  email: string;

  @ApiProperty({ example: 'John' })
  first_name: string;

  @ApiProperty({ example: 'Doe' })
  last_name: string;

  @ApiProperty({ example: [UserRole.PATIENT], type: [String] })
  role: UserRole[];
}

export class TokensDto {
  @ApiProperty({
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    description: 'JWT access token with 15 minutes expiration',
  })
  access_token: string;

  @ApiProperty({
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    description: 'JWT refresh token with 7 days expiration',
  })
  refresh_token: string;
}

class RoutedAuthResponseDto extends TokensDto {
  @ApiProperty({ type: UserDto })
  user: UserDto;

  @ApiProperty({
    enum: AuthRoutingTarget,
    example: AuthRoutingTarget.PATIENT_HOME,
  })
  routing_target: AuthRoutingTarget;

  @ApiProperty({
    enum: AuthAccessLevel,
    example: AuthAccessLevel.FULL,
  })
  access_level: AuthAccessLevel;

  @ApiProperty({
    example: null,
    nullable: true,
    description: 'Current provider verification status, when applicable',
  })
  verification_status: string | null;
}

export class SignupResponseDto extends RoutedAuthResponseDto {
  @ApiProperty({
    enum: AuthRoutingTarget,
    example: AuthRoutingTarget.EMAIL_VERIFICATION,
  })
  routing_target: AuthRoutingTarget;

  @ApiProperty({
    enum: AuthAccessLevel,
    example: AuthAccessLevel.LIMITED,
  })
  access_level: AuthAccessLevel;

  @ApiProperty({
    example: '201',
    nullable: true,
  })
  status_code?: number;

  @ApiProperty({
    example: 'account created',
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

export class LoginResponseDto extends RoutedAuthResponseDto {
  @ApiProperty({
    example: '200',
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

export class RefreshTokenResponseDto extends RoutedAuthResponseDto {
  @ApiProperty({
    example: '200',
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
    example: '200',
    nullable: true,
  })
  status_code?: number;

  @ApiProperty({
    example: 'logout success',
    nullable: true,
  })
  message?: string;
}
