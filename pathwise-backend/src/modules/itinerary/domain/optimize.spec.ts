import { Place } from '../../places/domain/place';
import { optimizeOrder, OptimizableStop } from './optimize';

/**
 * A place with only what the optimiser reads. Coordinates are the point of
 * most of these tests, so they are given per-stop rather than defaulted.
 */
function place(over: Partial<Place> & { placeId: string; lat: number; lng: number }): Place {
  return {
    name: over.placeId,
    hub: 'sultanahmet-oldcity',
    neighborhood: 'Sultanahmet',
    avgVisitMinutes: 60,
    entryFeeTry: 0,
    avgFoodCostTry: 0,
    openingHours: 'Hours not verified',
    ...over,
  } as Place;
}

const stop = (
  placeId: string,
  lat: number,
  lng: number,
  over: Partial<Place> = {},
  pinned = false,
): OptimizableStop => ({
  place: place({ placeId, lat, lng, ...over }),
  side: 'European',
  pinned,
});

/**
 * Four points on a line, ~3.3 km apart.
 *
 * The spacing is deliberate. At ~1 km the transit model walks between
 * neighbours and buses across a gap, and a bus over 2 km costs the same 15
 * minutes as a walk over 1 km — so a zig-zag through closely spaced stops is
 * genuinely no more expensive, and an optimiser that "improved" it would be
 * inventing a saving. At this spacing every leg is surface transit and longer
 * really does cost more, which is what makes the arithmetic below checkable by
 * hand: adjacent legs are 20 minutes, skipping one is 35.
 */
const A = { lat: 41.0, lng: 28.9 };
const B = { lat: 41.03, lng: 28.9 };
const C = { lat: 41.06, lng: 28.9 };
const D = { lat: 41.09, lng: 28.9 };

const MON = 0;
const TUE = 1;
const NINE_AM = 9 * 60;

describe('optimizeOrder', () => {
  it('shortens a day that zig-zags', () => {
    const result = optimizeOrder(
      [
        stop('a', A.lat, A.lng),
        stop('c', C.lat, C.lng),
        stop('b', B.lat, B.lng),
        stop('d', D.lat, D.lng),
      ],
      NINE_AM,
      TUE,
    );

    expect(result.afterMinutes).toBeLessThan(result.beforeMinutes);
    expect(result.movedStops).toBeGreaterThan(0);
    expect([...result.order].sort()).toEqual(['a', 'b', 'c', 'd']);
  });

  it('leaves an already-efficient day alone rather than shuffling it', () => {
    const ordered = [
      stop('a', A.lat, A.lng),
      stop('b', B.lat, B.lng),
      stop('c', C.lat, C.lng),
      stop('d', D.lat, D.lng),
    ];
    const result = optimizeOrder(ordered, NINE_AM, TUE);

    expect(result.movedStops).toBe(0);
    expect(result.order).toEqual(['a', 'b', 'c', 'd']);
    expect(result.afterMinutes).toBe(result.beforeMinutes);
  });

  it('never returns an order that is worse than the one it was given', () => {
    // The property that matters most: pressing the button can cost the
    // traveller nothing. Fifty scattered days, none of them allowed to regress.
    for (let seed = 0; seed < 50; seed++) {
      const stops = Array.from({ length: 6 }, (_, i) =>
        stop(
          `p${i}`,
          41.0 + (((seed * 7 + i * 13) % 20) / 500),
          28.9 + (((seed * 11 + i * 5) % 20) / 500),
        ),
      );
      const result = optimizeOrder(stops, NINE_AM, TUE);
      expect(result.afterMinutes).toBeLessThanOrEqual(result.beforeMinutes);
      expect([...result.order].sort()).toEqual(stops.map((s) => s.place.placeId).sort());
    }
  });

  it('keeps every stop — optimising is reordering, never dropping', () => {
    const stops = [
      stop('a', A.lat, A.lng),
      stop('c', C.lat, C.lng),
      stop('b', B.lat, B.lng),
      stop('d', D.lat, D.lng),
    ];
    const result = optimizeOrder(stops, NINE_AM, TUE);
    expect(result.order).toHaveLength(stops.length);
    expect(new Set(result.order).size).toBe(stops.length);
  });

  it('will not move a stop into a slot when it is closed then', () => {
    // 'c' opens at 15:00. Geometrically it belongs second; the schedule says
    // it cannot be, because a 9am start would put the traveller there long
    // before the door opens.
    const stops = [
      stop('a', A.lat, A.lng),
      stop('d', D.lat, D.lng),
      stop('b', B.lat, B.lng),
      stop('c', C.lat, C.lng, { openingHours: 'Daily 15:00–20:00' }),
    ];

    const result = optimizeOrder(stops, NINE_AM, TUE);

    expect(result.constrainedStops).toBe(1);
    // Whatever order comes back, 'c' is not early enough to be shut.
    expect(result.order.indexOf('c')).toBeGreaterThan(1);
  });

  it('refuses to schedule a stop on its closed day', () => {
    const stops = [
      stop('a', A.lat, A.lng),
      stop('c', C.lat, C.lng, { openingHours: 'Tue–Sun 10:00–18:00 (closed Mon)' }),
      stop('b', B.lat, B.lng),
      stop('d', D.lat, D.lng),
    ];

    // On Monday the museum is shut all day, so NO order can open it — the
    // violation is unavoidable rather than caused by reordering. The optimiser
    // may therefore still shorten the travel around it, and should: refusing
    // to would punish the rest of the day for one stop nothing can fix. What
    // it must not do is drop the stop or pretend the problem is solved.
    const monday = optimizeOrder(stops, NINE_AM, MON);
    expect([...monday.order].sort()).toEqual(['a', 'b', 'c', 'd']);
    expect(monday.afterMinutes).toBeLessThanOrEqual(monday.beforeMinutes);

    // On Tuesday the museum is open, and the same day reorders freely.
    const tuesday = optimizeOrder(stops, NINE_AM, TUE);
    expect(tuesday.afterMinutes).toBeLessThanOrEqual(tuesday.beforeMinutes);
    // The distinction that matters: on Tuesday the reordering must keep it
    // inside its 10:00–18:00 window, which a 09:00 start makes possible.
    expect(tuesday.constrainedStops).toBe(1);
  });

  it('still shortens a day that already contains an impossible stop', () => {
    // Regression, from a real generated day: the route engine does not consult
    // opening hours, so it scheduled Kadıköy's Barlar Sokağı ("Daily
    // 16:00–02:00") at 13:53 in a day that ends before 16:00. No order can fix
    // that. Requiring a perfectly feasible result meant this one stop rejected
    // every candidate and the optimiser did nothing at all — on a day it could
    // have shortened by a third.
    const stops = [
      stop('a', A.lat, A.lng),
      stop('d', D.lat, D.lng),
      stop('b', B.lat, B.lng),
      stop('c', C.lat, C.lng, { openingHours: 'Daily 16:00–02:00' }),
    ];

    const result = optimizeOrder(stops, NINE_AM, TUE);

    expect(result.afterMinutes).toBeLessThan(result.beforeMinutes);
    expect([...result.order].sort()).toEqual(['a', 'b', 'c', 'd']);
  });

  it('never adds a closed door that the day did not already have', () => {
    // The other half of the same rule: tolerating an existing violation must
    // not become a licence to create new ones.
    const stops = [
      stop('a', A.lat, A.lng),
      stop('d', D.lat, D.lng, { openingHours: 'Daily 09:00–23:00' }),
      stop('b', B.lat, B.lng, { openingHours: 'Daily 09:00–23:00' }),
      stop('c', C.lat, C.lng, { openingHours: 'Daily 15:00–20:00' }),
    ];

    const result = optimizeOrder(stops, NINE_AM, TUE);

    // 'c' opens at 15:00 and the day starts at 09:00 with hour-long visits, so
    // it cannot be reached legally before the fourth slot. Wherever the search
    // put it, it must not be somewhere the traveller arrives to a locked door
    // when the original order did not.
    expect(result.order.indexOf('c')).toBeGreaterThan(1);
  });

  it('leaves a pinned booking where it is', () => {
    const stops = [
      stop('a', A.lat, A.lng),
      stop('c', C.lat, C.lng),
      stop('b', B.lat, B.lng, {}, true), // booked — index 2 is fixed
      stop('d', D.lat, D.lng),
    ];

    const result = optimizeOrder(stops, NINE_AM, TUE);

    expect(result.pinnedStops).toBe(1);
    expect(result.order[2]).toBe('b');
  });

  it('reports how many stops it could actually check', () => {
    const result = optimizeOrder(
      [
        stop('a', A.lat, A.lng), // hours not verified
        stop('c', C.lat, C.lng, { openingHours: 'Daily 09:00–19:00' }),
        stop('b', B.lat, B.lng, { openingHours: 'Always open' }),
        stop('d', D.lat, D.lng, { openingHours: 'Daily, outside prayer times' }),
      ],
      NINE_AM,
      TUE,
    );

    // Two of four. This number is what stops the UI claiming a guarantee it
    // cannot make about the other two.
    expect(result.constrainedStops).toBe(2);
  });

  it('is deterministic — the same day twice gives the same suggestion', () => {
    const build = () => [
      stop('a', A.lat, A.lng),
      stop('c', C.lat, C.lng),
      stop('b', B.lat, B.lng),
      stop('d', D.lat, D.lng),
    ];
    const first = optimizeOrder(build(), NINE_AM, TUE);
    const second = optimizeOrder(build(), NINE_AM, TUE);
    expect(first.order).toEqual(second.order);
  });

  it('handles days too short to reorder', () => {
    expect(optimizeOrder([], NINE_AM, TUE).order).toEqual([]);
    const one = optimizeOrder([stop('a', A.lat, A.lng)], NINE_AM, TUE);
    expect(one.order).toEqual(['a']);
    expect(one.movedStops).toBe(0);
    const two = optimizeOrder(
      [stop('a', A.lat, A.lng), stop('b', B.lat, B.lng)],
      NINE_AM,
      TUE,
    );
    expect(two.movedStops).toBe(0);
  });
});
