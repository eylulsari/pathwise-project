import { PlacesService } from '../../places/application/places.service';
import { InMemoryPlaceRepository } from '../../places/infrastructure/persistence/in-memory-place.repository';
import {
  HUB_DATASET,
  HUB_SIDE,
} from '../../places/infrastructure/persistence/hub.dataset';
import { Itinerary, RouteGenerationInput } from '../domain/itinerary';
import { MAX_TRIP_DAYS, planHubSequence } from '../domain/day-plan';
import { HubBudgetStrategy } from './strategies/hub-budget.strategy';

/**
 * A full week, generated the way the dashboard generates it: one plan per day,
 * each from the hub the day plan assigned.
 *
 * The dashboard shipped three hardcoded days for its whole life, so nothing had
 * ever asked what happens at seven. The question that mattered was whether the
 * catalogue runs out — 202 places across 15 hubs, a day taking at most 8 stops.
 * It does not, but that is only worth believing if something checks, because
 * the failure mode is silent repetition rather than a crash. Two hubs hold
 * fewer places than the stop cap, so a short day is expected; an *empty* one is
 * not, which is why that is asserted separately.
 *
 * Failures are collected into arrays and asserted empty rather than checked one
 * at a time: a bare `expect(...).toBe(true)` on day five tells you a week is
 * broken without telling you where.
 */
describe('a seven-day trip', () => {
  const strategy = new HubBudgetStrategy(
    new PlacesService(new InMemoryPlaceRepository()),
  );

  const dayInput = (hub: RouteGenerationInput['hub']): RouteGenerationInput => ({
    hub,
    budgetTry: 3000,
    paceHours: 8,
    group: 'solo',
    interests: ['history', 'food', 'photo', 'view'],
    mustVisitIds: [],
    weather: 'sunny',
    startHour: 9,
    // Pinned. Generation reads opening hours, and with no weekday given it
    // takes today in Istanbul — which would make every assertion below depend
    // on the day the suite happens to run. Tuesday: nothing in the catalogue
    // closes on it, so these tests keep measuring what they are about.
    weekday: 1,
  });

  const generateWeek = async (): Promise<Itinerary[]> => {
    const out: Itinerary[] = [];
    for (const hub of planHubSequence(MAX_TRIP_DAYS, HUB_DATASET)) {
      out.push(await strategy.generate(dayInput(hub)));
    }
    return out;
  };

  let week: Itinerary[];
  beforeAll(async () => {
    week = await generateWeek();
  });

  const realStops = (day: Itinerary) =>
    day.stops.filter((s) => s.place).map((s) => s.place!);

  it('produces exactly seven days', () => {
    expect(week).toHaveLength(MAX_TRIP_DAYS);
  });

  it('leaves no day empty', () => {
    // The silent failure this guards: a hub that cannot fill a day returns
    // `stops: []` and the tab renders blank with no explanation.
    const empty = week
      .map((day, i) => ({ day: i + 1, hub: day.hub, stops: realStops(day).length }))
      .filter((d) => d.stops === 0);
    expect(empty).toEqual([]);
  });

  it('never sends anyone to the same place twice in a week', () => {
    const firstSeen = new Map<string, number>();
    const repeats: string[] = [];
    week.forEach((day, i) => {
      for (const place of realStops(day)) {
        const earlier = firstSeen.get(place.placeId);
        if (earlier !== undefined) {
          repeats.push(`${place.name}: day ${earlier + 1} and day ${i + 1}`);
        } else {
          firstSeen.set(place.placeId, i);
        }
      }
    });
    expect(repeats).toEqual([]);
    // …and the week is substantial, so the check above is not vacuous.
    expect(firstSeen.size).toBeGreaterThan(20);
  });

  it('never repeats a neighbourhood', () => {
    const hubs = week.map((d) => d.hub);
    expect(hubs).toHaveLength(new Set(hubs).size);
  });

  it('keeps every day inside its pace budget', () => {
    const overruns = week
      .map((day, i) => ({ day: i + 1, minutes: day.totalDurationMinutes }))
      .filter((d) => d.minutes > 8 * 60);
    expect(overruns).toEqual([]);
  });

  it('keeps the islands a day of their own', () => {
    const mixed = week
      .map((day, i) => ({
        day: i + 1,
        sides: [...new Set(realStops(day).map((p) => HUB_SIDE[p.hub]))],
      }))
      .filter((d) => d.sides.includes('Islands') && d.sides.length > 1);
    expect(mixed).toEqual([]);
  });

  it('never puts a ferry between two stops on the same shore', () => {
    const bogus: string[] = [];
    week.forEach((day, i) => {
      day.stops.forEach((stop, index) => {
        if (stop.transportToNext?.mode !== 'ferry' || !stop.place) return;
        const next = day.stops[index + 1]?.place;
        if (!next) return;
        const sameSide = HUB_SIDE[stop.place.hub] === HUB_SIDE[next.hub];
        const differentIsland =
          HUB_SIDE[stop.place.hub] === 'Islands' &&
          stop.place.neighborhood !== next.neighborhood;
        if (sameSide && !differentIsland) {
          bogus.push(`day ${i + 1}: ${stop.place.name} → ${next.name}`);
        }
      });
    });
    expect(bogus).toEqual([]);
  });

  it('generates a week fast enough to feel instant', async () => {
    // The dashboard fires these as the user switches tabs, so a slow engine
    // shows up as a stalling UI rather than a number anyone measures.
    const started = Date.now();
    await generateWeek();
    expect(Date.now() - started).toBeLessThan(1000);
  });
});
