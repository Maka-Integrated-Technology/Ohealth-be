import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';

import { ChatService } from './chat.service';
import { Chat } from './entities/chat.entity';
import { Message } from './entities/message.entity';

describe('ChatService', () => {
  it('returns explicit chat history fields without serializing the related user', async () => {
    const chatRepository = {
      find: jest.fn().mockResolvedValue([
        {
          id: 'chat-id',
          created_at: new Date('2026-01-15T10:30:00.000Z'),
          updated_at: new Date('2026-01-15T10:31:00.000Z'),
          user: {
            id: 'user-id',
            email: 'person@example.com',
            password: 'must-not-be-serialized',
            reset_token: 'must-not-be-serialized',
          },
        },
      ]),
    } as unknown as Repository<Chat>;
    const messageRepository = {
      find: jest.fn().mockResolvedValue([
        {
          id: 'message-id',
          chat: { id: 'chat-id' },
          sender: 'user',
          content: 'Hello',
          created_at: new Date('2026-01-15T10:30:00.000Z'),
          updated_at: new Date('2026-01-15T10:30:00.000Z'),
        },
      ]),
    } as unknown as Repository<Message>;
    const service = new ChatService(
      chatRepository,
      messageRepository,
      {} as ConfigService,
    );

    const result = await service.getHistory('user-id');

    expect(result).toEqual({
      chats: [
        {
          id: 'chat-id',
          created_at: new Date('2026-01-15T10:30:00.000Z'),
          updated_at: new Date('2026-01-15T10:31:00.000Z'),
        },
      ],
      messages: [
        {
          id: 'message-id',
          chat_id: 'chat-id',
          sender: 'user',
          content: 'Hello',
          created_at: new Date('2026-01-15T10:30:00.000Z'),
          updated_at: new Date('2026-01-15T10:30:00.000Z'),
        },
      ],
    });
    expect(JSON.stringify(result)).not.toContain('must-not-be-serialized');
  });
});
