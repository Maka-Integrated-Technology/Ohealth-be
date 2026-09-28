import { ApiProperty } from '@nestjs/swagger';

export class ChatSessionResponseDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  id: string;

  @ApiProperty({ example: '2026-01-15T10:30:00.000Z', format: 'date-time' })
  created_at: Date;

  @ApiProperty({ example: '2026-01-15T10:31:00.000Z', format: 'date-time' })
  updated_at: Date;
}

export class ChatMessageResponseDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440001' })
  id: string;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  chat_id: string;

  @ApiProperty({ enum: ['user', 'ai'], example: 'user' })
  sender: string;

  @ApiProperty({ example: 'What are common flu symptoms?' })
  content: string;

  @ApiProperty({ example: '2026-01-15T10:30:00.000Z', format: 'date-time' })
  created_at: Date;

  @ApiProperty({ example: '2026-01-15T10:30:00.000Z', format: 'date-time' })
  updated_at: Date;
}

export class SendChatMessageResponseDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  chatId: string;

  @ApiProperty({
    example:
      'Common flu symptoms include fever, cough, body aches, and fatigue.',
  })
  ai: string;
}

export class ChatHistoryResponseDto {
  @ApiProperty({ type: [ChatSessionResponseDto] })
  chats: ChatSessionResponseDto[];

  @ApiProperty({ type: [ChatMessageResponseDto] })
  messages: ChatMessageResponseDto[];
}
