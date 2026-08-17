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

    /*
     * The three answers added to the quiz are carried through as their own
     * fields, and none of them is allowed near `hub` or `interests`.
     *
     * Those two are decided by the mood answer alone, and they are decided by
     * replacement — `interests` is overwritten here, not merged. Expressing
     * "first time in Istanbul" as an interest would therefore either be
     * discarded by that overwrite or, if appended, silently change which
     * places match the +25-per-overlap term that the mood answer is supposed
     * to control. Steering the hub from a walking or first-visit answer would
     * be worse still: the traveller picked a mood and would get someone
     * else's neighbourhood.
     *
     * So each new answer stays a separate, weaker term in scoring, and a
     * traveller who answers only the first three questions gets precisely the
     * route they got before the other four existed.
     */
    const normalized: RouteGenerationInput = {
      ...input,
      hub,
      interests,
      paceHours: QuizVibeStrategy.PACE_HOURS[quiz.pace],
      budgetTry: quiz.budgetTry,
      // "Who with?" is the group the rest of the engine already costs and
      // scores by; the quiz answers the same question the dashboard does.
      group: quiz.party ?? input.group,
      walkingTolerance: quiz.walkingTolerance ?? input.walkingTolerance,
      visitedBefore: quiz.visitedBefore ?? input.visitedBefore,
    };

    // Reuse the core engine — this is the whole point of the pattern.
    return this.hubBudget.generate(normalized);
  }
}
