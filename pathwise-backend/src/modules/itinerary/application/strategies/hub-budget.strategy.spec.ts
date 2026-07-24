import { PlacesService } from '../../../places/application/places.service';
import { InMemoryPlaceRepository } from '../../../places/infrastructure/persistence/in-memory-place.repository';
import { RouteGenerationInput } from '../../domain/itinerary';
import { HubBudgetStrategy } from './hub-budget.strategy';

/** Builds a real PlacesService over the curated in-memory dataset. */
function makeStrategy(): HubBudgetStrategy {
  const places = new PlacesService(new InMemoryPlaceRepository());
  return new HubBudgetStrategy(places);
}

const baseInput = (over: Partial<RouteGenerationInput> = {}): RouteGenerationInput => ({
  hub: 'kadikoy-moda',
  budgetTry: 2000,
  paceHours: 6,
  group: 'solo',
  interests: ['food', 'photo'],
  mustVisitIds: [],
  weather: 'sunny',
  startHour: 10,
  ...over,
});

describe('HubBudgetStrategy', () => {
  const strategy = makeStrategy();

  it('generates stops only from the requested hub (plus must-visits)', async () => {
    const result = await strategy.generate(baseInput({ hub: 'balat-fener' }));
    const realStops = result.stops.filter((s) => s.place);
    expect(realStops.length).toBeGreaterThan(0);
    expect(realStops.every((s) => s.place!.hub === 'balat-fener')).toBe(true);
  });

  it('keeps the total visit time within the pace budget', async () => {
    const paceHours = 4;
    const result = await strategy.generate(baseInput({ paceHours }));
    const visitMinutes = result.stops
      .filter((s) => s.place)
      .reduce((sum, s) => sum + s.durationMinutes, 0);
    expect(visitMinutes).toBeLessThanOrEqual(paceHours * 60);
  });

  it('inserts an automatic lunch break when the day spans midday', async () => {
    const result = await strategy.generate(baseInput({ startHour: 10, paceHours: 6 }));
    const lunch = result.stops.filter((s) => s.isLunchBreak);
    expect(lunch).toHaveLength(1);
    expect(lunch[0].foodCostTry).toBeGreaterThan(0);
  });

  it('NEVER drops a must-visit, even with a tiny budget and pace', async () => {
    const result = await strategy.generate(
      baseInput({
        budgetTry: 100,
        paceHours: 2,
        mustVisitIds: ['ChIJ-sultanahmet-hagiasophia'],
      }),
    );
    const ids = result.stops.filter((s) => s.place).map((s) => s.place!.placeId);
    expect(ids).toContain('ChIJ-sultanahmet-hagiasophia');
  });

  it('flags overBudget when cost exceeds the budget', async () => {
    const result = await strategy.generate(
      baseInput({ budgetTry: 100, mustVisitIds: ['ChIJ-sultanahmet-topkapi'] }),
    );
    expect(result.costBreakdown.totalTry).toBeGreaterThan(result.budgetTry);
    expect(result.overBudget).toBe(true);
  });

  it('on rain, swaps an outdoor stop for an indoor one from the same hub', async () => {
    const input = baseInput({
      hub: 'sultanahmet',
      interests: ['nature', 'photo'],
      paceHours: 3,
      startHour: 11,
    });
    const sunny = await strategy.generate({ ...input, weather: 'sunny' });
    const rainy = await strategy.generate({ ...input, weather: 'rainy' });

    const outdoorSunny = sunny.stops.filter((s) => s.place && !s.place.isIndoor).length;
    const outdoorRainy = rainy.stops.filter((s) => s.place && !s.place.isIndoor).length;
    // Rainy plan should never have MORE outdoor stops than the sunny one.
    expect(outdoorRainy).toBeLessThanOrEqual(outdoorSunny);
  });

  it('pushes sunset spots to the end when starting in the evening', async () => {
    const result = await strategy.generate(
      baseInput({ hub: 'besiktas-bogaz', startHour: 17, paceHours: 8, interests: ['nature', 'photo', 'food'] }),
    );
    const real = result.stops.filter((s) => s.place);
    const firstSunsetIdx = real.findIndex((s) => s.place!.isSunsetSpot);
    const lastNonSunsetIdx = real.map((s) => s.place!.isSunsetSpot).lastIndexOf(false);
    if (firstSunsetIdx !== -1) {
      expect(firstSunsetIdx).toBeGreaterThan(lastNonSunsetIdx - 1);
    }
  });

  it('produces valid HH:mm times and a non-negative cost breakdown', async () => {
    const result = await strategy.generate(baseInput());
    for (const stop of result.stops) {
      expect(stop.arrivalTime).toMatch(/^\d{2}:\d{2}$/);
      expect(stop.departureTime).toMatch(/^\d{2}:\d{2}$/);
    }
    const { ticketsTry, foodTry, transportTry, totalTry } = result.costBreakdown;
    expect(ticketsTry + foodTry + transportTry).toBe(totalTry);
    expect(totalTry).toBeGreaterThanOrEqual(0);
  });
});
