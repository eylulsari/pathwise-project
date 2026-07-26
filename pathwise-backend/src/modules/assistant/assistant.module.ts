import { Module } from '@nestjs/common';
import { PlacesModule } from '../places/places.module';
import { AssistantService } from './application/assistant.service';
import { AssistantController } from './infrastructure/http/assistant.controller';
import { GeminiClient } from './infrastructure/gemini/gemini.client';
import { ChatRateLimitGuard } from './infrastructure/guards/chat-rate-limit.guard';

/**
 * AI assistant backed by Google Gemini. ConfigService (key/model) and Redis
 * (rate limit) are global. PlacesModule is imported for its exported
 * PlacesService — the grounding data source. Degrades to a canned answer when
 * the key is missing or any Gemini call fails; never load-bearing.
 */
@Module({
  imports: [PlacesModule],
  controllers: [AssistantController],
  providers: [AssistantService, GeminiClient, ChatRateLimitGuard],
})
export class AssistantModule {}
