import { ApiProperty } from '@nestjs/swagger';

export class EnableTwoFactorAuthDataDto {
  @ApiProperty({
    description: 'Enrollment secret; returned once and must be protected.',
  })
  secret: string;

  @ApiProperty({})
  qrCodeUrl: string;

  @ApiProperty({ example: 600 })
  expires_in_seconds: number;
}
