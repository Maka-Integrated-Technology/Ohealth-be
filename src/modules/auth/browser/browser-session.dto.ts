import { ApiProperty } from '@nestjs/swagger';

import { UserRole } from '../../user/enums/user-role.enum';
import { AuthAccessLevel, AuthRoutingTarget } from '../enums/auth-routing.enum';

class BrowserSessionUserDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'john.doe@example.com' })
  email: string;

  @ApiProperty({ example: 'John' })
  first_name: string;

  @ApiProperty({ example: 'Doe' })
  last_name: string;

  @ApiProperty({ example: [UserRole.PATIENT], type: [String] })
  role: UserRole[];
}

export class BrowserSessionResponseDto {
  @ApiProperty({ example: 'Login success' })
  message: string;

  @ApiProperty({ description: 'Short-lived access JWT for in-memory use only' })
  access_token: string;

  @ApiProperty({ format: 'uuid' })
  session_id: string;

  @ApiProperty({ format: 'date-time' })
  session_expires_at: Date;

  @ApiProperty({ type: BrowserSessionUserDto })
  user: BrowserSessionUserDto;

  @ApiProperty({ enum: AuthRoutingTarget })
  routing_target: AuthRoutingTarget;

  @ApiProperty({ enum: AuthAccessLevel })
  access_level: AuthAccessLevel;

  @ApiProperty({ nullable: true })
  verification_status: string | null;
}
