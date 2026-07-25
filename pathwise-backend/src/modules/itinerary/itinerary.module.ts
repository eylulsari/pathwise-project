import { Module } from '@nestjs/common';
import { PlacesModule } from '../places/places.module';
import { UsersModule } from '../users/users.module';
import { ItineraryService } from './application/itinerary.service';
import { ItineraryController } from './infrastructure/http/itinerary.controller';
import { RouteStrategyFactory } from './application/route-strategy.factory';
import { HubBudgetStrategy } from './application/strategies/hub-budget.strategy';
import { QuizVibeStrategy } from './application/strategies/quiz-vibe.strategy';
import { OptimizeLimitGuard } from '../../common/guards/optimize-limit.guard';

@Module({
  imports: [PlacesModule, UsersModule], // strategies pull places; guard reads tier
  controllers: [ItineraryController],
  providers: [
    ItineraryService,
    RouteStrategyFactory,
    HubBudgetStrategy,
    QuizVibeStrategy,
    OptimizeLimitGuard,
  ],
  exports: [ItineraryService],
})
export class ItineraryModule {}
