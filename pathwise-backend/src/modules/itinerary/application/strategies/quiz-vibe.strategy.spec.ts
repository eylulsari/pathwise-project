import { PlacesService } from '../../../places/application/places.service';
import { InMemoryPlaceRepository } from '../../../places/infrastructure/persistence/in-memory-place.repository';
import { RouteGenerationInput } from '../../domain/itinerary';
import { HubBudgetStrategy } from './hub-budget.strategy';
import { QuizVibeStrategy } from './quiz-vibe.strategy';

function makeStrategy() {
  const places = new PlacesService(new InMemoryPlaceRepository());
  const hubBudget = new HubBudgetStrategy(places);
  return { hubBudget, quiz: new QuizVibeStrategy(hubBudget) };
}

const input = (over: Partial<RouteGenerationInput> = {}): RouteGenerationInput => ({
  budgetTry: 2000,
  paceHours: 5,
  group: 'solo',
  interests: [],
  mustVisitIds: [],
  weather: 'sunny',
  startHour: 10,
  ...over,
});

describe('QuizVibeStrategy', () => {
  it.each([
    ['history', 'sultanahmet'],
    ['foodie', 'kadikoy-moda'],
    ['art', 'karakoy-galata'],
    ['photo', 'balat-fener'],
  ] as const)('maps mood "%s" to hub "%s"', async (mood, hub) => {
    const { quiz } = makeStrategy();
    const result = await quiz.generate(
      input({ quiz: { mood, pace: 'moderate', budgetTry: 2000 } }),
    );
    expect(result.hub).toBe(hub);
    expect(result.mode).toBe('quiz-vibe');
  });

  it('delegates to HubBudgetStrategy (reuses its scoring — DRY)', async () => {
    const { hubBudget, quiz } = makeStrategy();
    const spy = jest.spyOn(hubBudget, 'generate');
    await quiz.generate(input({ quiz: { mood: 'foodie', pace: 'packed', budgetTry: 3000 } }));
    expect(spy).toHaveBeenCalledTimes(1);
    // The normalized input handed to the core engine carries the mapped hub.
    expect(spy.mock.calls[0][0].hub).toBe('kadikoy-moda');
    expect(spy.mock.calls[0][0].budgetTry).toBe(3000);
  });

  it('translates pace into hours (relaxed<moderate<packed)', async () => {
    const { hubBudget, quiz } = makeStrategy();
    const spy = jest.spyOn(hubBudget, 'generate');
    for (const pace of ['relaxed', 'moderate', 'packed'] as const) {
      await quiz.generate(input({ quiz: { mood: 'history', pace, budgetTry: 2000 } }));
    }
    const [relaxed, moderate, packed] = spy.mock.calls.map((c) => c[0].paceHours);
    expect(relaxed).toBeLessThan(moderate);
    expect(moderate).toBeLessThan(packed);
  });
});
