import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUUID } from 'class-validator';

export class SendMessageDto {
  @ApiProperty({ example: 'chat-uuid', description: 'Chat session ID' })
  @IsUUID()
  chatId: string;

  @ApiProperty({ example: 'Hello, AI!', description: 'Message content' })
  @IsString()
  content: string;
}
