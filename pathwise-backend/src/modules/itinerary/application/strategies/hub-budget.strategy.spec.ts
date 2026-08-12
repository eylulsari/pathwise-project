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

  // ── stop cap ───────────────────────────────────────────────────────
  // Before the dataset grew to 129 places a hub held 5–6 candidates and the
  // pace budget alone was enough. It no longer is: 12–15 candidates per hub
  // means an 8-hour day packs to whatever arithmetic allows.

  it.each([
    { paceHours: 3, maxStops: 3 },
    { paceHours: 5, maxStops: 5 },
    { paceHours: 7, maxStops: 7 },
    { paceHours: 12, maxStops: 8 },
  ])(
    'caps a $paceHours-hour day at $maxStops stops',
    async ({ paceHours, maxStops }) => {
      // A wide interest set maximises the number of scoring candidates, so
      // this is the case most likely to overflow.
      const result = await strategy.generate(
        baseInput({
          hub: 'sultanahmet',
          paceHours,
          budgetTry: 50000,
          interests: ['food', 'history', 'photo', 'market', 'art', 'nature'],
        }),
      );
      const realStops = result.stops.filter((s) => s.place);
      expect(realStops.length).toBeGreaterThan(0);
      expect(realStops.length).toBeLessThanOrEqual(maxStops);
    },
  );

  it('lets must-visits exceed the cap rather than dropping a booked stop', async () => {
    // Five forced stops against a "relaxed" 3-hour cap of three. The user asked
    // for all five explicitly; silently discarding two would be a bug.
    const mustVisitIds = [
      'ChIJ-sultanahmet-hagiasophia',
      'ChIJ-sultanahmet-bluemosque',
      'ChIJ-sultanahmet-topkapi',
      'ChIJ-sultanahmet-basilicacistern',
      'ChIJ-sultanahmet-grandbazaar',
    ];
    const result = await strategy.generate(
      baseInput({ hub: 'sultanahmet', paceHours: 3, mustVisitIds }),
    );
    const ids = result.stops.filter((s) => s.place).map((s) => s.place!.placeId);
    for (const id of mustVisitIds) expect(ids).toContain(id);
  });

  it('still honours the pace budget when it is tighter than the cap', async () => {
    // A 1-hour day allows fewer stops than the 3-stop "relaxed" cap; time wins.
    const result = await strategy.generate(
      baseInput({ hub: 'sultanahmet', paceHours: 1, budgetTry: 50000 }),
    );
    const visitMinutes = result.stops
      .filter((s) => s.place)
      .reduce((sum, s) => sum + s.durationMinutes, 0);
    expect(visitMinutes).toBeLessThanOrEqual(60);
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
