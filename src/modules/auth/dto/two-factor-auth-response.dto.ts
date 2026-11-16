import { ApiProperty } from '@nestjs/swagger';

export class EnableTwoFactorAuthDataDto {
  @ApiProperty({ example: 'JBSWY3DPEHPK3PXP' })
  secret: string;

  @ApiProperty({
    example: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...',
  })
  qrCodeUrl: string;

  @ApiProperty({ example: 600 })
  expires_in_seconds: number;
}
