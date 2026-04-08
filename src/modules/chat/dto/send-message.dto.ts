import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID } from 'class-validator';

export class SendMessageDto {
  @ApiPropertyOptional({
    example: '7f0c53b4-57c4-4e53-8c3f-d3e9cf6fe5de',
    description: 'Existing chat session ID. Omit this to start a new chat.',
  })
  @IsOptional()
  @IsUUID()
  chatId?: string;

  @ApiProperty({ example: 'Hello, AI!', description: 'Message content' })
  @IsString()
  content: string;
}
