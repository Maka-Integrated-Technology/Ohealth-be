import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUUID, Matches } from 'class-validator';

export class VerifyAuthChallengeDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  challenge_id: string;

  @ApiProperty({ example: '123456' })
  @IsString()
  @Matches(/^\d{6}$/, { message: 'Verification code must be 6 digits' })
  code: string;
}

export class ResendAuthChallengeDto {
  @ApiProperty({
    format: 'uuid',
    description: 'Opaque login challenge ID returned after password proof',
  })
  @IsUUID()
  challenge_id: string;
}
