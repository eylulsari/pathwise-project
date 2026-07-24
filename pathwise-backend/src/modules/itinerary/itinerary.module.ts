import { Module } from '@nestjs/common';
import { PlacesModule } from '../places/places.module';
import { ItineraryService } from './application/itinerary.service';
import { ItineraryController } from './infrastructure/http/itinerary.controller';
import { RouteStrategyFactory } from './application/route-strategy.factory';
import { HubBudgetStrategy } from './application/strategies/hub-budget.strategy';
import { QuizVibeStrategy } from './application/strategies/quiz-vibe.strategy';

@Module({
  imports: [PlacesModule], // strategies pull places via PlacesService
  controllers: [ItineraryController],
  providers: [
    ItineraryService,
    RouteStrategyFactory,
    HubBudgetStrategy,
    QuizVibeStrategy,
  ],
  exports: [ItineraryService],
})
export class ItineraryModule {}
