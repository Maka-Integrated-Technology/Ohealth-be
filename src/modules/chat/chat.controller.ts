import { Controller, Post, Body, UseGuards, Get } from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

import { ChatService } from './chat.service';
import { SendMessageDto } from './dto/send-message.dto';

interface IAuthenticatedUser {
  id: string;
}

@ApiTags('Ai-Chat')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post('send')
  @ApiOperation({ summary: 'Send a message to the AI' })
  @ApiResponse({ status: 201, description: 'AI response returned.' })
  async sendMessage(
    @CurrentUser() user: IAuthenticatedUser,
    @Body() dto: SendMessageDto,
  ) {
    return this.chatService.sendMessage(user.id, dto);
  }

  @Get('history')
  @ApiOperation({ summary: 'Get chat history for the logged-in user' })
  @ApiResponse({ status: 200, description: 'Chat history returned.' })
  async getHistory(@CurrentUser() user: IAuthenticatedUser) {
    return this.chatService.getHistory(user.id);
  }
}
