import { ApiProperty } from '@nestjs/swagger';

import { UserRole } from '../../user/enums/user-role.enum';
import { AuthContextResponseDto } from '../dto/auth-response.dto';
import { AuthAccessLevel, AuthRoutingTarget } from '../enums/auth-routing.enum';

export class BrowserSessionResponseDto {
  @ApiProperty({ example: 'Login success' })
  message: string;

  @ApiProperty({ description: 'Short-lived access JWT for in-memory use only' })
  access_token: string;

  @ApiProperty({ format: 'uuid' })
  session_id: string;

  @ApiProperty({ format: 'date-time' })
  session_expires_at: Date;

  @ApiProperty({ type: AuthContextResponseDto })
  account_context: AuthContextResponseDto;

  @ApiProperty({ deprecated: true })
  user: {
    id: string;
    email: string;
    first_name: string;
    last_name: string;
    role: UserRole[];
  };

  @ApiProperty({ enum: AuthRoutingTarget, deprecated: true })
  routing_target: AuthRoutingTarget;

  @ApiProperty({ enum: AuthAccessLevel, deprecated: true })
  access_level: AuthAccessLevel;

  @ApiProperty({ nullable: true, deprecated: true })
  verification_status: string | null;
}
