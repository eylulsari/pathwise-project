import { PlacesService } from '../../places/application/places.service';
import { InMemoryPlaceRepository } from '../../places/infrastructure/persistence/in-memory-place.repository';
import { RouteStrategyFactory } from './route-strategy.factory';
import { HubBudgetStrategy } from './strategies/hub-budget.strategy';
import { QuizVibeStrategy } from './strategies/quiz-vibe.strategy';

describe('RouteStrategyFactory', () => {
  const places = new PlacesService(new InMemoryPlaceRepository());
  const hubBudget = new HubBudgetStrategy(places);
  const quizVibe = new QuizVibeStrategy(hubBudget);
  const factory = new RouteStrategyFactory(hubBudget, quizVibe);

  it('returns HubBudgetStrategy for "hub-budget"', () => {
    expect(factory.create('hub-budget')).toBe(hubBudget);
  });

  it('returns QuizVibeStrategy for "quiz-vibe"', () => {
    expect(factory.create('quiz-vibe')).toBe(quizVibe);
  });

  it('defaults to HubBudgetStrategy for an unknown mode', () => {
    expect(factory.create('nonsense' as never)).toBe(hubBudget);
  });
});
