import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { ApiErrorResponseDto } from '../../../common/dto/response.dto';
import { AuthChallengeErrorCode } from '../challenges/auth-challenge.error';

export class AuthChallengeErrorResponseDto extends ApiErrorResponseDto {
  @ApiProperty({ enum: AuthChallengeErrorCode })
  declare error_code: AuthChallengeErrorCode;

  @ApiPropertyOptional({ type: 'integer', minimum: 1, example: 42 })
  declare retry_after_seconds?: number;
}

export class AuthChallengeContinuationDto {
  @ApiProperty({ example: 'Verification code queued' })
  message: string;

  @ApiProperty({ format: 'uuid' })
  challenge_id: string;

  @ApiProperty({ example: 60 })
  resend_after_seconds: number;

  @ApiProperty({ example: 600 })
  expires_in_seconds: number;
}

export class RegistrationPendingResponseDto extends AuthChallengeContinuationDto {
  @ApiProperty({ example: 'a***@example.com' })
  delivery_target: string;
}
