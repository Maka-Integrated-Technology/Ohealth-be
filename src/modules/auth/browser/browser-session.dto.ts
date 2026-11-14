import { ApiProperty } from '@nestjs/swagger';

export class BrowserSessionResponseDto {
  @ApiProperty({ example: 'Login success' })
  message: string;

  @ApiProperty({ description: 'Short-lived access JWT for in-memory use only' })
  access_token: string;

  @ApiProperty({ format: 'uuid' })
  session_id: string;

  @ApiProperty({ format: 'date-time' })
  session_expires_at: Date;

  @ApiProperty({
    type: Object,
    description: 'Server-resolved canonical account context',
  })
  account_context: Record<string, unknown>;
}
