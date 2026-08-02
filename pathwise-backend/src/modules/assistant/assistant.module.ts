import { Module } from '@nestjs/common';
import { PlacesModule } from '../places/places.module';
import { AssistantService } from './application/assistant.service';
import { AssistantController } from './infrastructure/http/assistant.controller';
import { GeminiClient } from './infrastructure/gemini/gemini.client';
import { GroqClient } from './infrastructure/groq/groq.client';
import { ChatRateLimitGuard } from './infrastructure/guards/chat-rate-limit.guard';

/**
 * AI assistant backed by Groq or Google Gemini — whichever key is configured
 * (Groq first). ConfigService (keys/models) and Redis (rate limit) are global.
 * PlacesModule is imported for its exported PlacesService — the grounding data
 * source. Degrades to a canned answer when no key is set or the LLM call fails;
 * never load-bearing.
 */
@Module({
  imports: [PlacesModule],
  controllers: [AssistantController],
  providers: [AssistantService, GeminiClient, GroqClient, ChatRateLimitGuard],
})
export class AssistantModule {}
