import { ApiProperty } from '@nestjs/swagger';

import { AuthContextResponseDto } from '../dto/auth-response.dto';

export class BrowserSessionResponseDto {
  @ApiProperty({ example: 'login success' })
  message: string;

  @ApiProperty({ description: 'Short-lived access JWT for in-memory use only' })
  access_token: string;

  @ApiProperty({ format: 'uuid' })
  session_id: string;

  @ApiProperty({ format: 'date-time' })
  session_expires_at: Date;

  @ApiProperty({ type: AuthContextResponseDto })
  account_context: AuthContextResponseDto;
}
