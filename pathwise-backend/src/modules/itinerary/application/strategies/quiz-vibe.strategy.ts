import { Injectable } from '@nestjs/common';
import { Hub, Interest } from '../../../places/domain/place';
import {
  Itinerary,
  QuizInput,
  RouteGenerationInput,
} from '../../domain/itinerary';
import { RouteGenerationStrategy } from '../../domain/route-generation-strategy.port';
import { HubBudgetStrategy } from './hub-budget.strategy';

/**
 * QuizVibeStrategy — turns Travel Vibe Quiz answers into a hub + interests +
 * pace, then delegates to HubBudgetStrategy. No scoring logic is duplicated
 * here (DRY): the quiz is purely a mapping layer on top of the core engine.
 */
@Injectable()
export class QuizVibeStrategy implements RouteGenerationStrategy {
  constructor(private readonly hubBudget: HubBudgetStrategy) {}

  /** mood → the hub + interests it best matches. */
  private static readonly MOOD_MAP: Record<
    QuizInput['mood'],
    { hub: Hub; interests: Interest[] }
  > = {
    history: { hub: 'sultanahmet', interests: ['history', 'photo'] },
    foodie: { hub: 'kadikoy-moda', interests: ['food', 'market'] },
    art: { hub: 'karakoy-galata', interests: ['art', 'photo'] },
    photo: { hub: 'balat-fener', interests: ['photo', 'history'] },
  };

  /** pace → hours available for the day. */
  private static readonly PACE_HOURS: Record<QuizInput['pace'], number> = {
    relaxed: 3,
    moderate: 5,
    packed: 7,
  };

  async generate(input: RouteGenerationInput): Promise<Itinerary> {
    const quiz = input.quiz;
    if (!quiz) {
      // Defensive: without quiz answers behave like the core strategy.
      return this.hubBudget.generate(input);
    }

    const { hub, interests } = QuizVibeStrategy.MOOD_MAP[quiz.mood];

    const normalized: RouteGenerationInput = {
      ...input,
      hub,
      interests,
      paceHours: QuizVibeStrategy.PACE_HOURS[quiz.pace],
      budgetTry: quiz.budgetTry,
    };

    // Reuse the core engine — this is the whole point of the pattern.
    return this.hubBudget.generate(normalized);
  }
}
