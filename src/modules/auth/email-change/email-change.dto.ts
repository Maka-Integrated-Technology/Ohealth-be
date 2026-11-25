import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class BeginEmailChangeDto {
  @ApiPropertyOptional({
    description:
      'Required for password-enabled accounts; passwordless Google accounts instead require a recently created session',
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(1024)
  current_password?: string;

  @ApiPropertyOptional({ description: 'Required when MFA is enabled' })
  @IsOptional()
  @IsString()
  @Matches(/^\d{6}$/)
  mfa_code?: string;

  @ApiProperty()
  @IsString()
  @MaxLength(254)
  candidate_email: string;
}

export class EmailChangeChallengeDto {
  @ApiProperty({ format: 'uuid' }) challenge_id: string;
  @ApiProperty() expires_in_seconds: number;
  @ApiProperty() resend_after_seconds: number;
}

export class EmailChangeHandleDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  challenge_id: string;
}

export class ConfirmEmailChangeDto extends EmailChangeHandleDto {
  @ApiProperty()
  @IsString()
  @Matches(/^\d{6}$/)
  code: string;
}

export class EmailChangeCommittedDto {
  @ApiProperty({ example: true }) sessions_revoked: boolean;
}
