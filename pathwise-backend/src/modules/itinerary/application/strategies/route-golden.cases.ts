import { Itinerary, RouteGenerationInput } from '../../domain/itinerary';

/**
 * The inputs the quiz change must not disturb, and the shape they are compared
 * in.
 *
 * Every case here is written the way a caller wrote it *before* the quiz gained
 * questions four to seven: no walking tolerance, no first-visit answer, and a
 * group drawn from the three values that existed then. The paired fixture was
 * captured by running these against the engine as it stood at that commit, so
 * the regression test compares new code against old behaviour rather than
 * against itself.
 *
 * Every case pins weekday to Tuesday. Generation now consults opening hours,
 * and an unpinned case would take "today in Istanbul" — making the fixture
 * pass on a Wednesday and fail on the Monday when the closed-day museums drop
 * out of it. A regression baseline that depends on the day it is run is not a
 * baseline. Tuesday is chosen because nothing in the catalogue closes on it,
 * so these cases keep testing scoring rather than the calendar; the closed-day
 * behaviour has its own tests in hub-budget.strategy.spec.ts.
 *
 * Shared with the spec rather than inlined so both sides cannot drift.
 */
export const GOLDEN_CASES: Record<string, RouteGenerationInput> = {
  'solo, kadikoy, midday': {
    hub: 'kadikoy-moda',
    budgetTry: 2000,
    paceHours: 6,
    group: 'solo',
    interests: ['food', 'photo'],
    mustVisitIds: [],
    weather: 'sunny',
    startHour: 10,
    weekday: 1, // Tuesday — pinned, see the note above
  },
  'couple, sultanahmet, rain': {
    hub: 'sultanahmet',
    budgetTry: 3000,
    paceHours: 7,
    group: 'couple',
    interests: ['history', 'architecture'],
    mustVisitIds: [],
    weather: 'rainy',
    startHour: 9,
    weekday: 1, // Tuesday — pinned, see the note above
  },
  'friends, beyoglu, evening': {
    hub: 'beyoglu-taksim',
    budgetTry: 2500,
    paceHours: 5,
    group: 'friends',
    interests: ['nightlife', 'food'],
    mustVisitIds: [],
    weather: 'sunny',
    startHour: 17,
    weekday: 1, // Tuesday — pinned, see the note above
  },
  'must-visits and a pinned booking': {
    hub: 'karakoy-galata',
    budgetTry: 1500,
    paceHours: 6,
    group: 'couple',
    interests: ['art', 'view'],
    mustVisitIds: ['ChIJ-karakoy-galatatower'],
    weather: 'sunny',
    startHour: 11,
    weekday: 1, // Tuesday — pinned, see the note above
    reservations: [{ placeId: 'ChIJ-karakoy-galatatower', time: '14:30' }],
  },
  'tight budget and pace': {
    hub: 'eminonu-sirkeci',
    budgetTry: 300,
    paceHours: 3,
    group: 'solo',
    interests: ['market'],
    mustVisitIds: [],
    weather: 'sunny',
    startHour: 9,
    weekday: 1, // Tuesday — pinned, see the note above
  },
  'island day': {
    hub: 'adalar',
    budgetTry: 2000,
    paceHours: 7,
    group: 'friends',
    interests: ['nature', 'relax'],
    mustVisitIds: [],
    weather: 'sunny',
    startHour: 9,
    weekday: 1, // Tuesday — pinned, see the note above
  },
  'quiz mode, history + relaxed': {
    hub: undefined,
    budgetTry: 1800,
    paceHours: 6,
    group: 'solo',
    interests: [],
    mustVisitIds: [],
    weather: 'sunny',
    startHour: 10,
    weekday: 1, // Tuesday — pinned, see the note above
    quiz: { mood: 'history', pace: 'relaxed', budgetTry: 1800 },
  },
  'quiz mode, foodie + packed': {
    hub: undefined,
    budgetTry: 2400,
    paceHours: 4,
    group: 'friends',
    interests: [],
    mustVisitIds: [],
    weather: 'sunny',
    startHour: 11,
    weekday: 1, // Tuesday — pinned, see the note above
    quiz: { mood: 'foodie', pace: 'packed', budgetTry: 2400 },
  },
  'no interests at all': {
    hub: 'uskudar',
    budgetTry: 1200,
    paceHours: 5,
    group: 'solo',
    interests: [],
    mustVisitIds: [],
    weather: 'sunny',
    startHour: 10,
    weekday: 1, // Tuesday — pinned, see the note above
  },
};

/**
 * Everything about a generated day that a traveller would notice, minus
 * `generatedAt` — a timestamp differing between two runs says nothing about the
 * engine and would make the comparison fail every time.
 */
export function summarise(it: Itinerary) {
  return {
    hub: it.hub,
    mode: it.mode,
    group: it.group,
    stops: it.stops.map((s) => ({
      order: s.order,
      placeId: s.place?.placeId ?? null,
      isLunchBreak: s.isLunchBreak,
      arrivalTime: s.arrivalTime,
      departureTime: s.departureTime,
      durationMinutes: s.durationMinutes,
      transportMode: s.transportToNext?.mode ?? null,
      transportMinutes: s.transportToNext?.durationMinutes ?? null,
    })),
    costBreakdown: it.costBreakdown,
    overBudget: it.overBudget,
    totalDistanceKm: it.totalDistanceKm,
    totalDurationMinutes: it.totalDurationMinutes,
    notices: it.notices,
  };
}
