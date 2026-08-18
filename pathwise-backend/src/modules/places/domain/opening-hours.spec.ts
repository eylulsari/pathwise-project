import { readFileSync } from 'fs';
import { join } from 'path';
import {
  isClosedOn,
  isOpenThroughout,
  parseSchedule,
} from './opening-hours';

const MON = 0;
const TUE = 1;
const WED = 2;
const SUN = 6;
const at = (h: number, m = 0) => h * 60 + m;

describe('parseSchedule', () => {
  it('returns null for the unknowns, which must never read as "closed"', () => {
    // The distinction the optimiser depends on: null is "nobody recorded it",
    // and a caller treating that as closed would freeze three quarters of the
    // catalogue in place.
    expect(parseSchedule('Hours not verified')).toBeNull();
    expect(parseSchedule(undefined)).toBeNull();
    expect(parseSchedule('')).toBeNull();
    expect(parseSchedule('Daily, outside prayer times')).toBeNull();
    expect(parseSchedule('Lobby daily; performances evenings')).toBeNull();
  });

  it('treats "Always open" as open at any hour of any day', () => {
    const s = parseSchedule('Always open')!;
    expect(s.alwaysOpen).toBe(true);
    expect(isOpenThroughout(s, MON, at(3), at(4))).toBe(true);
    expect(isClosedOn(s, MON)).toBe(false);
  });

  it('reads a daily window and closes outside it', () => {
    const s = parseSchedule('Daily 09:00–19:00')!;
    expect(isOpenThroughout(s, WED, at(10), at(11))).toBe(true);
    expect(isOpenThroughout(s, WED, at(8), at(9, 30))).toBe(false);
    expect(isOpenThroughout(s, WED, at(18), at(20))).toBe(false);
  });

  it('honours a closed day', () => {
    const s = parseSchedule('Tue–Sun 10:00–18:00 (closed Mon)')!;
    expect(isClosedOn(s, MON)).toBe(true);
    expect(isClosedOn(s, TUE)).toBe(false);
    expect(isOpenThroughout(s, MON, at(12), at(13))).toBe(false);
    expect(isOpenThroughout(s, TUE, at(12), at(13))).toBe(true);
  });

  it('handles a range that wraps past Sunday', () => {
    const s = parseSchedule('Wed–Mon 09:00–18:00 (closed Tue)')!;
    expect(isClosedOn(s, TUE)).toBe(true);
    expect(isClosedOn(s, SUN)).toBe(false);
    expect(isClosedOn(s, MON)).toBe(false);
  });

  it('checks the whole visit, not just the arrival', () => {
    const s = parseSchedule('Daily 09:00–18:00')!;
    // Arriving at 17:50 somewhere that shuts at 18:00 is a locked door ten
    // minutes later, not a visit.
    expect(isOpenThroughout(s, WED, at(17, 50), at(18, 50))).toBe(false);
    // Leaving exactly at closing time is fine.
    expect(isOpenThroughout(s, WED, at(17), at(18))).toBe(true);
  });

  it('handles a window that runs past midnight', () => {
    const s = parseSchedule('Daily 10:00–00:00')!;
    expect(isOpenThroughout(s, WED, at(23), at(23, 30))).toBe(true);
    expect(isOpenThroughout(s, WED, at(9), at(9, 30))).toBe(false);
  });
});

/**
 * The dataset is the contract.
 *
 * This parser and the client's open-now badge read the same strings from
 * different packages, so a batch of places written in a shape only one of them
 * understands would show up as a silent disagreement rather than a failure.
 * Reading the real file keeps that honest: if a future import introduces a new
 * format, the count moves and this test says so.
 */
describe('the shipped dataset', () => {
  const source = readFileSync(
    join(__dirname, '../infrastructure/persistence/place.dataset.ts'),
    'utf8',
  );
  const values = [...source.matchAll(/openingHours:\s*'([^']*)'/g)].map((m) => m[1]);

  it('is read without throwing, and every value resolves to a schedule or null', () => {
    expect(values.length).toBeGreaterThan(100);
    for (const value of values) {
      expect(() => parseSchedule(value)).not.toThrow();
    }
  });

  it('leaves most places unconstrained, which is why unknown cannot mean closed', () => {
    const parsed = values.filter((v) => parseSchedule(v) !== null);
    // Not pinned to an exact number — new places arrive. The claim under test
    // is the shape of the data the feature has to live with: the majority
    // carry no usable hours, so "optimised" can only ever mean "nothing known
    // is violated". If this ever flips, the UI wording should be revisited.
    expect(parsed.length).toBeLessThan(values.length / 2);
  });
});
