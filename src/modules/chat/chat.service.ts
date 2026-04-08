import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import axios from 'axios';
import { Repository } from 'typeorm';

import { SendMessageDto } from './dto/send-message.dto';
import { Chat } from './entities/chat.entity';
import { Message } from './entities/message.entity';

const DEFAULT_MEDICAL_SYSTEM_PROMPT = `
You are HealthBridge's AI medical assistant.

Your role is to provide clear, careful, evidence-informed health guidance for general medical questions across a wide range of specialties.

Rules:
- Be professional, calm, and easy to understand.
- Use the previous conversation as context and keep your answers consistent with it.
- Ask brief clarifying questions when the user's symptoms, timeline, age, medications, or medical history are missing.
- Do not invent diagnoses, test results, medications, or patient history.
- Explain likely possibilities and next steps instead of presenting uncertain information as fact.
- Encourage users to see a licensed clinician for diagnosis, prescriptions, treatment plans, or worsening symptoms.
- If the message suggests an emergency or red-flag symptoms such as chest pain, severe trouble breathing, stroke signs, seizures, heavy bleeding, or suicidal thoughts, clearly advise immediate emergency care.
- Keep answers practical and structured, including self-care, warning signs, and when to seek medical attention.

You are not a replacement for an in-person doctor. Do not claim to have examined the patient.
`.trim();

@Injectable()
export class ChatService {
  constructor(
    @InjectRepository(Chat) private chatRepo: Repository<Chat>,
    @InjectRepository(Message) private messageRepo: Repository<Message>,
    private configService: ConfigService,
  ) {}

  async sendMessage(userId: string, dto: SendMessageDto) {
    // Find or create chat
    let chat: Chat | null = null;

    if (dto.chatId) {
      chat = await this.chatRepo.findOne({
        where: { id: dto.chatId, user: { id: userId } },
      });
    }

    if (!chat) {
      chat = this.chatRepo.create({ user: { id: userId } });
      await this.chatRepo.save(chat);
    }
    // Save user message
    const userMsg = this.messageRepo.create({
      chat,
      sender: 'user',
      content: dto.content,
    });
    await this.messageRepo.save(userMsg);

    // Call OpenRouter API
    const apiKey = this.configService.get('openrouter.apiKey');
    const baseUrl = this.configService.get('openrouter.baseUrl');
    const model = this.configService.get('openrouter.model');
    const systemPrompt =
      this.configService.get<string>('openrouter.systemPrompt') ||
      DEFAULT_MEDICAL_SYSTEM_PROMPT;
    const contextMessageLimit =
      this.configService.get<number>('openrouter.contextMessageLimit') || 20;

    const recentMessages = await this.messageRepo.find({
      where: { chat: { id: chat.id } },
      order: { created_at: 'DESC' },
      take: contextMessageLimit,
    });

    const conversationMessages = recentMessages.reverse().map((message) => ({
      role: message.sender === 'ai' ? 'assistant' : 'user',
      content: message.content,
    }));

    try {
      const response = await axios.post(
        `${baseUrl}/chat/completions`,
        {
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            ...conversationMessages,
          ],
        },
        {
          headers: { Authorization: `Bearer ${apiKey}` },
        },
      );
      const aiContent = response.data.choices[0].message.content;
      // Save AI message
      const aiMsg = this.messageRepo.create({
        chat,
        sender: 'ai',
        content: aiContent,
      });
      await this.messageRepo.save(aiMsg);
      return { chatId: chat.id, ai: aiContent };
    } catch {
      throw new HttpException(
        'Failed to get AI response',
        HttpStatus.BAD_GATEWAY,
      );
    }
  }

  async getHistory(userId: string) {
    const chats = await this.chatRepo.find({
      where: { user: { id: userId } },
      relations: ['user'],
    });
    const messages = await this.messageRepo.find({
      where: { chat: { user: { id: userId } } },
      relations: ['chat'],
    });
    return { chats, messages };
  }
}
