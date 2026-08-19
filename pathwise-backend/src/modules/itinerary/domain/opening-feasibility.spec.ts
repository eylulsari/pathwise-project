import { Place } from '../../places/domain/place';
import { respectOpeningHours } from './opening-feasibility';

/**
 * The rule being protected: the engine may not schedule a visit to a place
 * that is shut at the hour it picked. It used to, on every generated Kadıköy
 * day — Barlar Sokağı opens at 16:00 and was planned for 12:51.
 */

const place = (over: Partial<Place>): Place =>
  ({
    placeId: over.placeId ?? 'p',
    name: over.name ?? 'Place',
    avgVisitMinutes: over.avgVisitMinutes ?? 60,
    openingHours: over.openingHours ?? '',
    lat: 41,
    lng: 29,
  }) as Place;

/** Ten minutes between anything and anything, so timing is easy to read. */
const tenMinutesApart = () => 10;

const MON = 0;
const TUE = 1;

describe('respectOpeningHours', () => {
  it('moves a place that opens later down the day rather than dropping it', () => {
    // The shape of the real bug: nearest-neighbour ordering put Barlar Sokağı
    // first because it was closest, and the clock said 12:51.
    const bar = place({ placeId: 'b', name: 'Bar', openingHours: 'Daily 16:00–02:00' });
    const museums = ['m1', 'm2', 'm3'].map((id) =>
      place({ placeId: id, openingHours: 'Daily 09:00–18:00' }),
    );

    // 12:00 start, three hour-long visits ten minutes apart → the bar comes up
    // at 15:30, half an hour before it opens.
    const result = respectOpeningHours({
      ordered: [bar, ...museums],
      startMinutes: 12 * 60,
      weekday: TUE,
      travelMinutes: tenMinutesApart,
    });

    expect(result.ordered.map((p) => p.placeId)).toEqual(['m1', 'm2', 'm3', 'b']);
    expect(result.dropped).toEqual([]);
    expect(result.waits.get('b')).toBe(30);
  });

  it('drops a place that is shut for the whole weekday', () => {
    const monday = place({
      placeId: 'shut',
      name: 'Monday Museum',
      openingHours: 'Tue–Sun 09:00–18:00',
    });
    const open = place({ placeId: 'ok', openingHours: 'Daily 09:00–18:00' });

    const result = respectOpeningHours({
      ordered: [monday, open],
      startMinutes: 10 * 60,
      weekday: MON,
      travelMinutes: tenMinutesApart,
    });

    expect(result.ordered.map((p) => p.placeId)).toEqual(['ok']);
    expect(result.dropped).toEqual([
      { place: monday, reason: 'closed-all-day' },
    ]);
  });

  it('waits a short while for a door rather than abandoning the stop', () => {
    // Arrive 15:40, opens 16:00. Twenty minutes is a coffee, not a defect.
    const bar = place({ placeId: 'b', openingHours: 'Daily 16:00–02:00' });

    const result = respectOpeningHours({
      ordered: [bar],
      startMinutes: 15 * 60 + 40,
      weekday: TUE,
      travelMinutes: tenMinutesApart,
    });

    expect(result.ordered.map((p) => p.placeId)).toEqual(['b']);
    expect(result.waits.get('b')).toBe(20);
  });

  it('refuses a wait nobody would actually stand through', () => {
    // Arrive 10:00, opens 16:00. Six hours outside a bar is not a plan.
    const bar = place({ placeId: 'b', openingHours: 'Daily 16:00–02:00' });

    const result = respectOpeningHours({
      ordered: [bar],
      startMinutes: 10 * 60,
      weekday: TUE,
      travelMinutes: tenMinutesApart,
    });

    expect(result.ordered).toEqual([]);
    expect(result.dropped[0].reason).toBe('never-open-in-time');
  });

  it('leaves places with no hours on record exactly where they were', () => {
    // Three quarters of the catalogue has no opening-hours string. Treating
    // silence as "probably shut" would empty the day on missing data.
    const a = place({ placeId: 'a', openingHours: '' });
    const b = place({ placeId: 'b', openingHours: 'Hours not verified' });
    const c = place({ placeId: 'c', openingHours: '' });

    const result = respectOpeningHours({
      ordered: [a, b, c],
      startMinutes: 3 * 60, // the middle of the night
      weekday: TUE,
      travelMinutes: tenMinutesApart,
    });

    expect(result.ordered.map((p) => p.placeId)).toEqual(['a', 'b', 'c']);
    expect(result.dropped).toEqual([]);
  });

  it('keeps the engine’s order when everything is already open', () => {
    // The order it was given is geographic. Nothing here should disturb it
    // for its own sake.
    const ordered = ['x', 'y', 'z'].map((id) =>
      place({ placeId: id, openingHours: 'Daily 09:00–20:00' }),
    );

    const result = respectOpeningHours({
      ordered,
      startMinutes: 10 * 60,
      weekday: TUE,
      travelMinutes: tenMinutesApart,
    });

    expect(result.ordered.map((p) => p.placeId)).toEqual(['x', 'y', 'z']);
    expect(result.waits.size).toBe(0);
  });
});
