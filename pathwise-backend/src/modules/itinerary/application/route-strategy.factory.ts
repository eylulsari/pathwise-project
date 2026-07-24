import { Injectable } from '@nestjs/common';
import { RouteMode } from '../domain/itinerary';
import { RouteGenerationStrategy } from '../domain/route-generation-strategy.port';
import { HubBudgetStrategy } from './strategies/hub-budget.strategy';
import { QuizVibeStrategy } from './strategies/quiz-vibe.strategy';

/**
 * Factory Pattern — returns the right RouteGenerationStrategy for a mode string.
 * Adding a new generation mode is a one-line change here plus the new strategy.
 */
@Injectable()
export class RouteStrategyFactory {
  constructor(
    private readonly hubBudget: HubBudgetStrategy,
    private readonly quizVibe: QuizVibeStrategy,
  ) {}

  create(mode: RouteMode): RouteGenerationStrategy {
    switch (mode) {
      case 'quiz-vibe':
        return this.quizVibe;
      case 'hub-budget':
      default:
        return this.hubBudget;
    }
  }
}
