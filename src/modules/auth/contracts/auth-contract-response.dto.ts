import { ApiProperty } from '@nestjs/swagger';

export class RegistrationPendingResponseDto {
  @ApiProperty({ example: 'Verification code sent' })
  message: string;

  @ApiProperty({ format: 'uuid' })
  challenge_id: string;

  @ApiProperty({ example: 'a***@example.com' })
  delivery_target: string;

  @ApiProperty({ example: 60 })
  resend_after_seconds: number;

  @ApiProperty({ example: 600 })
  expires_in_seconds: number;
}
