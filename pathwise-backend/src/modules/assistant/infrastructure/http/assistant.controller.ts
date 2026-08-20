import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AssistantService } from '../../application/assistant.service';
import { ChatDto } from '../../application/dto/chat.dto';
import { GenerateAiRouteDto } from '../../application/dto/generate-ai-route.dto';
import { AssistantReply } from '../../domain/assistant.types';
import { ChatRateLimitGuard } from '../guards/chat-rate-limit.guard';
import { JwtAuthGuard } from '../../../auth/infrastructure/guards/jwt-auth.guard';

// JwtAuthGuard first (authenticates + sets req.user), then the per-user cap.
@UseGuards(JwtAuthGuard, ChatRateLimitGuard)
@Controller('assistant')
export class AssistantController {
  constructor(private readonly assistant: AssistantService) {}

  /** POST /api/assistant/chat — grounded Istanbul travel chat. */
  @Post('chat')
  @HttpCode(HttpStatus.OK)
  chat(@Body() dto: ChatDto): Promise<AssistantReply> {
    return this.assistant.chat({
      message: dto.message,
      conversationHistory: dto.conversationHistory ?? [],
      activePlan: dto.activePlan ?? [],
      dietary: dto.dietary,
    });
  }

  @Post('route')
  @HttpCode(HttpStatus.OK)
  generateRoute(@Body() dto: GenerateAiRouteDto) {
    return this.assistant.generateRoute(dto.prompt);
  }
}
