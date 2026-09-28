import { ApiProperty } from '@nestjs/swagger';

export class ActivateAccountResponseDto {
  @ApiProperty({ type: 'integer', example: 200 })
  status: number;

  @ApiProperty({ example: 'User account activated successfully' })
  message: string;
}
