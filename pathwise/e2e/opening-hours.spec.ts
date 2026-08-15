import { test, expect } from '@playwright/test';
import { openStatus, closingSoon, istanbulNow } from '../src/utils/openingHours';

/**
 * Unit tests for the open/closed parser. No browser is involved — Playwright is
 * already the project's test runner, so these ride in the existing suite rather
 * than bringing a second framework in for one file.
 *
 * The strings below are taken verbatim from the dataset. Every distinct shape
 * in it is represented, including the ones the parser must REFUSE: a wrong
 * "Open now" sends someone across Istanbul to a locked door.
 */

/** A fixed instant, expressed as Istanbul wall-clock time. */
function at(day: string, hhmm: string): Date {
  // Istanbul is UTC+3 year-round (no DST since 2016), so the offset is fixed.
  const [h, m] = hhmm.split(':').map(Number);
  const base = new Date(`${day}T00:00:00+03:00`);
  base.setUTCMinutes(base.getUTCMinutes() + h * 60 + m);
  return base;
}

// 2026-08-17 is a Monday; 2026-08-18 Tuesday; 2026-08-22 Saturday; 23rd Sunday.
const MON = '2026-08-17';
const TUE = '2026-08-18';
const SAT = '2026-08-22';
const SUN = '2026-08-23';

test.describe('istanbulNow', () => {
  test('reads Istanbul wall-clock time, not the machine’s', () => {
    // 21:00 UTC on the Monday is 00:00 Tuesday in Istanbul.
    const { minutes, day } = istanbulNow(new Date('2026-08-17T21:00:00Z'));
    expect(minutes).toBe(0);
    expect(day).toBe(1); // Tuesday, Monday-first
  });
});

test.describe('openStatus — says nothing when it cannot be sure', () => {
  for (const value of [
    undefined,
    '',
    'Hours not verified',
    'Daily, outside prayer times',
    'Daily, closed to visitors during prayer times',
    'Mosque: outside prayer times; Hamam: daily 08:00–22:00',
    'Lobby daily; performances evenings',
  ]) {
    test(`refuses ${JSON.stringify(value)}`, () => {
      expect(openStatus(value, at(TUE, '12:00'))).toBeNull();
    });
  }
});

test.describe('openStatus — plain daily hours', () => {
  test('open inside the window, with the closing time', () => {
    expect(openStatus('Daily 09:00–19:00', at(TUE, '12:00'))).toEqual({
      open: true,
      closesAt: '19:00',
    });
  });

  test('closed before opening and after closing', () => {
    expect(openStatus('Daily 09:00–19:00', at(TUE, '08:59'))).toEqual({ open: false });
    expect(openStatus('Daily 09:00–19:00', at(TUE, '19:00'))).toEqual({ open: false });
  });

  test('a bare time range means every day', () => {
    expect(openStatus('09:00-18:00', at(SUN, '10:00'))).toEqual({
      open: true,
      closesAt: '18:00',
    });
  });

  test('"Always open" is open with no closing time', () => {
    expect(openStatus('Always open', at(MON, '03:00'))).toEqual({ open: true });
  });

  test('an overnight window runs past midnight', () => {
    const hours = 'Daily 16:00–02:00';
    expect(openStatus(hours, at(TUE, '23:00'))?.open).toBe(true);
    expect(openStatus(hours, at(TUE, '01:00'))?.open).toBe(true);
    expect(openStatus(hours, at(TUE, '15:00'))?.open).toBe(false);
  });
});

test.describe('openStatus — day-restricted hours', () => {
  test('a museum closed on Monday reads closed on Monday', () => {
    // The single most common shape in the dataset, and the one a
    // first-range-wins parser gets wrong every Monday.
    expect(openStatus('Tu-Su 09:00–19:00', at(MON, '12:00'))).toEqual({ open: false });
    expect(openStatus('Tu-Su 09:00–19:00', at(TUE, '12:00'))).toEqual({
      open: true,
      closesAt: '19:00',
    });
  });

  test('three-letter day names work too', () => {
    expect(openStatus('Tue–Sun 09:00–16:00 (closed Mon)', at(MON, '12:00'))).toEqual({
      open: false,
    });
    expect(openStatus('Tue–Sun 09:00–16:00 (closed Mon)', at(SUN, '12:00'))).toEqual({
      open: true,
      closesAt: '16:00',
    });
  });

  test('a day range that wraps past Sunday', () => {
    // "Wed–Mon" covers Wed, Thu, Fri, Sat, Sun, Mon — closed Tuesday.
    const hours = 'Wed–Mon 09:00–18:00 (closed Tue)';
    expect(openStatus(hours, at(MON, '12:00'))?.open).toBe(true);
    expect(openStatus(hours, at(TUE, '12:00'))).toEqual({ open: false });
  });

  test('separate rules for different days', () => {
    const hours = 'Tu-Fr 09:00-17:00; Sa-Su 09:00-18:00';
    expect(openStatus(hours, at(TUE, '16:30'))).toEqual({ open: true, closesAt: '17:00' });
    expect(openStatus(hours, at(SAT, '17:30'))).toEqual({ open: true, closesAt: '18:00' });
    expect(openStatus(hours, at(MON, '12:00'))).toEqual({ open: false });
  });

  test('a day list, not just a range', () => {
    const hours = 'Tu, Th, Fr, Su 10:00-18:00; We, Sa 10:00-22:00';
    expect(openStatus(hours, at(TUE, '17:00'))).toEqual({ open: true, closesAt: '18:00' });
    expect(openStatus(hours, at(SAT, '21:00'))).toEqual({ open: true, closesAt: '22:00' });
    expect(openStatus(hours, at(MON, '12:00'))).toEqual({ open: false });
  });

  test('two windows on the same days (lunch break)', () => {
    const hours = 'Mon–Sat 12:00–16:00, 19:00–23:00';
    expect(openStatus(hours, at(MON, '13:00'))).toEqual({ open: true, closesAt: '16:00' });
    expect(openStatus(hours, at(MON, '17:00'))).toEqual({ open: false });
    expect(openStatus(hours, at(MON, '20:00'))).toEqual({ open: true, closesAt: '23:00' });
    expect(openStatus(hours, at(SUN, '13:00'))).toEqual({ open: false });
  });
});

test.describe('closingSoon', () => {
  test('true within 90 minutes of closing, false before that', () => {
    const hours = 'Daily 09:00–19:00';
    expect(closingSoon(openStatus(hours, at(TUE, '18:00')), at(TUE, '18:00'))).toBe(true);
    expect(closingSoon(openStatus(hours, at(TUE, '12:00')), at(TUE, '12:00'))).toBe(false);
  });

  test('never true for a closed place or one with no closing time', () => {
    expect(closingSoon(openStatus('Daily 09:00–19:00', at(TUE, '20:00')), at(TUE, '20:00'))).toBe(false);
    expect(closingSoon(openStatus('Always open', at(TUE, '20:00')), at(TUE, '20:00'))).toBe(false);
  });
});
