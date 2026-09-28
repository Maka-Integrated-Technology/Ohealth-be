import { ApiProperty } from '@nestjs/swagger';

export class EnableTwoFactorAuthDataDto {
  @ApiProperty({ example: 'JBSWY3DPEHPK3PXP' })
  secret: string;

  @ApiProperty({
    example: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...',
  })
  qrCodeUrl: string;

  @ApiProperty({
    example: ['A1B2C3D4', 'E5F6G7H8'],
    type: [String],
  })
  backupCodes: string[];
}
