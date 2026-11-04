import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class RevokeOwnedSessionDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  session_id: string;
}

export class SessionMetadataDto {
  @ApiProperty({ format: 'uuid' })
  session_id: string;

  @ApiProperty({ format: 'date-time' })
  created_at: Date;

  @ApiProperty({ format: 'date-time', nullable: true })
  last_used_at?: Date | null;

  @ApiProperty({ format: 'date-time' })
  expires_at: Date;
}
