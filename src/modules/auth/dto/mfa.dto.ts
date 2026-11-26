import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class BeginMfaDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(1024)
  password: string;

  @ApiPropertyOptional({ pattern: '^\\d{6}$' })
  @IsOptional()
  @IsString()
  @Matches(/^\d{6}$/)
  current_code?: string;
}

export class ConfirmMfaDto {
  @ApiProperty()
  @IsString()
  @Matches(/^\d{6}$/)
  code: string;
}

export class ChangeMfaDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(1024)
  password: string;

  @ApiProperty()
  @IsString()
  @Matches(/^\d{6}$/)
  code: string;
}

export class VerifyMfaLoginDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  challenge_id: string;

  @ApiProperty()
  @IsString()
  @Matches(/^(?:\d{6}|[A-Za-z0-9_-]{22})$/)
  code: string;
}

export class MfaChallengeResponseDto {
  @ApiProperty({ example: 'MFA verification required.' })
  message: string;
  @ApiProperty({ format: 'uuid' })
  mfa_challenge_id: string;
  @ApiProperty({ example: 600 })
  expires_in_seconds: number;
}

export class MfaRecoveryCodesResponseDto {
  @ApiProperty()
  message: string;
  @ApiProperty({ type: [String], description: 'Shown once. Store offline.' })
  recovery_codes: string[];
}
