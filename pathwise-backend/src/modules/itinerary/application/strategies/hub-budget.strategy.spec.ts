import { PlacesService } from '../../../places/application/places.service';
import { InMemoryPlaceRepository } from '../../../places/infrastructure/persistence/in-memory-place.repository';
import { RouteGenerationInput } from '../../domain/itinerary';
import { HubBudgetStrategy } from './hub-budget.strategy';
import {
  isClosedOn,
  isOpenThroughout,
  parseSchedule,
} from '../../../places/domain/opening-hours';

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

  // ── transit realism ────────────────────────────────────────────────
  // Growing from five hubs to ten put open water inside the planning space:
  // Adalar is a scheduled ferry away and Üsküdar/Kadıköy are the far shore.
  // The engine costed every hop by straight-line distance, so it happily
  // produced days nobody could physically walk.

  describe('the day it produces can actually be walked', () => {
    // The exact request from the audit. It returned a nine-stop day ending at
    // 18:05 on top of a hill on Büyükada, having crossed from Sultanahmet to
    // Kadıköy to the islands in "20 minutes" a leg, with no way home.
    const auditCase = () =>
      strategy.generate(
        baseInput({
          hub: 'sultanahmet',
          budgetTry: 3000,
          paceHours: 8,
          startHour: 9,
          interests: ['history', 'view'],
          mustVisitIds: [
            'ChIJ-sultanahmet-hagiasophia',
            'ChIJ-adalar-ayayorgikilisesi',
            'ChIJ-kadikoy-carsi',
          ],
        }),
      );

    it('refuses to put the islands and the mainland in the same day', async () => {
      const result = await auditCase();
      const hubs = result.stops.filter((s) => s.place).map((s) => s.place!.hub);
      expect(hubs).not.toContain('adalar');
      // …and the stop that could not be honoured is named, not silently gone.
      const notice = result.notices.find((n) => n.code === 'adalar-separate-day');
      expect(notice).toBeDefined();
      expect(notice!.severity).toBe('warning');
      expect(notice!.places).toContain('Aya Yorgi Kilisesi');
    });

    it('still honours the must-visits that CAN share a day', async () => {
      const result = await auditCase();
      const ids = result.stops.filter((s) => s.place).map((s) => s.place!.placeId);
      expect(ids).toContain('ChIJ-sultanahmet-hagiasophia');
      expect(ids).toContain('ChIJ-kadikoy-carsi');
    });

    it('charges the Bosphorus crossing what it really costs', async () => {
      const result = await auditCase();
      const ferries = result.stops
        .map((s) => s.transportToNext)
        .filter((l): l is NonNullable<typeof l> => l?.mode === 'ferry');
      expect(ferries.length).toBeGreaterThan(0);
      // Twenty minutes was the crossing with the walk to the pier and the wait
      // for the boat both free. Nothing that involves a boat is that cheap.
      for (const leg of ferries) expect(leg.durationMinutes).toBeGreaterThanOrEqual(45);
    });

    it('never puts a ferry between two stops on the same shore', async () => {
      // Inside a single mainland hub there is no water to cross, so a ferry leg
      // is proof the model fell back to guessing from distance.
      for (const hub of ['uskudar', 'sultanahmet', 'besiktas-bogaz'] as const) {
        const result = await strategy.generate(
          baseInput({ hub, paceHours: 8, startHour: 9, budgetTry: 50000 }),
        );
        const modes = result.stops.map((s) => s.transportToNext?.mode);
        expect(modes).not.toContain('ferry');
      }
    });
  });

  it('keeps the whole day — travel included — inside the requested pace', async () => {
    // Selection can only budget visit minutes; travel time is not known until
    // the stops are ordered. Every hub is checked because the overrun showed up
    // wherever the hops were long, not in one unlucky neighbourhood.
    for (const hub of ['sultanahmet', 'uskudar', 'kadikoy-moda', 'adalar'] as const) {
      const paceHours = 6;
      const result = await strategy.generate(
        baseInput({ hub, paceHours, startHour: 9, budgetTry: 50000 }),
      );
      expect(result.totalDurationMinutes).toBeLessThanOrEqual(paceHours * 60);
    }
  });

  describe('an island day', () => {
    it('leaves enough evening to catch the last ferry back', async () => {
      const startHour = 10;
      const result = await strategy.generate(
        baseInput({ hub: 'adalar', startHour, paceHours: 12, budgetTry: 50000 }),
      );
      const endMinutes = startHour * 60 + result.totalDurationMinutes;
      // 20:00 last boat, minus getting down to the pier and boarding.
      expect(endMinutes).toBeLessThanOrEqual(20 * 60 - 45);
      expect(result.notices.map((n) => n.code)).toContain('adalar-return-ferry');
    });

    it('warns instead of pretending when forced stops run past the last ferry', async () => {
      // Four long must-visits starting late: the engine cannot trim them away,
      // so the only honest move left is to say the boat may be gone.
      const result = await strategy.generate(
        baseInput({
          hub: 'adalar',
          startHour: 16,
          paceHours: 12,
          budgetTry: 50000,
          mustVisitIds: [
            'ChIJ-adalar-ayayorgikilisesi',
            'ChIJ-adalar-heybeliadaruhbanokulu',
            'ChIJ-adalar-prinkiporumyetimhanesi',
            'ChIJ-adalar-splendidpalasoteli',
          ],
        }),
      );
      const notice = result.notices.find((n) => n.code === 'adalar-last-ferry');
      expect(notice).toBeDefined();
      expect(notice!.severity).toBe('warning');
    });
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

/**
 * The generator used to plan visits to places that were shut at the hour it
 * chose. Measured across the golden cases before the fix: Kadıköy Barlar
 * Sokağı (opens 16:00) was scheduled for 12:51 on all seven days, and the
 * Museum of Turkish & Islamic Arts, Istanbul Modern, SALT Galata and the Grand
 * Bazaar were each planned into a day they are closed.
 */
describe('HubBudgetStrategy — opening hours', () => {
  const strategy = makeStrategy();
  const MONDAY = 0;
  const toMin = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

  it('does not plan the bar street before it opens', async () => {
    const result = await strategy.generate(
      baseInput({ hub: 'kadikoy-moda', startHour: 10, weekday: 2 }),
    );
    const bar = result.stops.find((s) => /Barlar Sokağı/.test(s.place?.name ?? ''));
    // Either it is not in the day at all, or it is in it at an hour it is open.
    if (bar) {
      expect(bar.place!.openingHours).toMatch(/16:00/);
      expect(toMin(bar.arrivalTime)).toBeGreaterThanOrEqual(16 * 60);
    }
  });

  it('plans no stop into an hour its own opening hours exclude, on any weekday', async () => {
    for (let weekday = 0; weekday < 7; weekday++) {
      const result = await strategy.generate(
        baseInput({ hub: 'kadikoy-moda', startHour: 10, weekday }),
      );
      for (const stop of result.stops) {
        if (!stop.place?.openingHours) continue;
        const schedule = parseSchedule(stop.place.openingHours);
        if (!schedule) continue; // hours we cannot read are nobody's evidence
        expect({
          day: weekday,
          place: stop.place.name,
          at: stop.arrivalTime,
          hours: stop.place.openingHours,
          open: isOpenThroughout(
            schedule,
            weekday,
            toMin(stop.arrivalTime),
            toMin(stop.departureTime),
          ),
        }).toMatchObject({ open: true });
      }
    }
  });

  it('leaves a Monday-closed museum out of a Monday, and says why', async () => {
    const result = await strategy.generate(
      baseInput({ hub: 'sultanahmet', interests: ['history'], weekday: MONDAY }),
    );
    for (const stop of result.stops) {
      if (!stop.place?.openingHours) continue;
      const schedule = parseSchedule(stop.place.openingHours);
      if (!schedule) continue;
      expect(isClosedOn(schedule, MONDAY)).toBe(false);
    }
  });

  it('still fills the day — the fix must not empty it', async () => {
    // The tempting over-correction is to treat unknown hours as closed, which
    // would delete three quarters of the catalogue.
    const result = await strategy.generate(baseInput({ weekday: MONDAY }));
    expect(result.stops.filter((s) => s.place).length).toBeGreaterThan(2);
  });

  it('does not silently drop a stop the traveller dragged into place', async () => {
    // rebuild() is the manual-edit path. Removing one of their stops there
    // would undo the edit they just made, so it warns instead of trimming.
    const generated = await strategy.generate(baseInput({ hub: 'kadikoy-moda' }));
    const ids = generated.stops.filter((s) => s.place).map((s) => s.place!.placeId);
    const withBar = [...ids, 'ChIJ-kadikoy-barlar'];

    const rebuilt = await strategy.rebuild(withBar, baseInput({ startHour: 10 }));
    const rebuiltIds = rebuilt.stops.filter((s) => s.place).map((s) => s.place!.placeId);
    expect(rebuiltIds).toContain('ChIJ-kadikoy-barlar');
  });
});
