import { PlacesService } from '../../../places/application/places.service';
import { InMemoryPlaceRepository } from '../../../places/infrastructure/persistence/in-memory-place.repository';
import { HubBudgetStrategy } from './hub-budget.strategy';
import { QuizVibeStrategy } from './quiz-vibe.strategy';
import { GOLDEN_CASES, summarise } from './route-golden.cases';
import golden from './route-golden.fixture.json';

/**
 * The quiz gained four questions. Nobody who does not answer them may notice.
 *
 * `route-golden.fixture.json` was captured by running the cases in
 * `route-golden.cases.ts` against the engine as it stood *before* those
 * questions existed, and committed unchanged. So this is not a snapshot test
 * that re-records itself when the output moves — it is a comparison against
 * behaviour that is no longer in the tree, and the only way to make it pass is
 * to leave that behaviour alone.
 *
 * If a future change to scoring is intended to move these routes, the fixture
 * has to be re-captured deliberately and the diff read stop by stop. It should
 * never be regenerated to make a red test go green.
 */
describe('a route asked for the old way comes back the old way', () => {
  const places = new PlacesService(new InMemoryPlaceRepository());
  const hubBudget = new HubBudgetStrategy(places);
  const quizVibe = new QuizVibeStrategy(hubBudget);

  it.each(Object.keys(GOLDEN_CASES))('%s', async (name) => {
    const input = GOLDEN_CASES[name];
    const strategy = input.quiz ? quizVibe : hubBudget;
    expect(summarise(await strategy.generate(input))).toEqual(
      (golden as Record<string, unknown>)[name],
    );
  });

  it('covers every case in the fixture, so none can be quietly dropped', () => {
    expect(Object.keys(GOLDEN_CASES).sort()).toEqual(Object.keys(golden).sort());
  });

  /**
   * The fields are optional in the type, but a caller can also send them
   * explicitly empty — a form that renders "no answer" as `undefined` rather
   * than omitting the key. That has to mean the same thing.
   */
  it('an explicitly unanswered question is the same as an absent one', async () => {
    const base = GOLDEN_CASES['solo, kadikoy, midday'];
    const explicit = await hubBudget.generate({
      ...base,
      walkingTolerance: undefined,
      visitedBefore: undefined,
    });
    expect(summarise(explicit)).toEqual(
      (golden as Record<string, unknown>)['solo, kadikoy, midday'],
    );
  });
});
