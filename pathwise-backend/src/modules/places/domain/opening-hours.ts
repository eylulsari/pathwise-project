/**
 * Opening hours as a schedule that can be asked about ANY time, not just now.
 *
 * RELATIONSHIP TO THE CLIENT PARSER
 * `pathwise/src/utils/openingHours.ts` reads the same strings to answer "is it
 * open right now?" for a badge. This one answers "is it open at 14:20 on a
 * Tuesday?", which is what an optimiser needs and what that one cannot do —
 * it resolves against the wall clock by design. The string format is the
 * contract between them, so `opening-hours.spec.ts` pins the exact values that
 * appear in the dataset: if a future batch introduces a shape only one side
 * understands, a test says so rather than the two quietly disagreeing.
 *
 * SILENCE WHEN UNSURE — the same rule, and it matters more here.
 * 145 of the 202 places in the dataset say "Hours not verified", and four more
 * are prose ("Daily, outside prayer times") that no parser should pretend to
 * resolve. Anything not understood returns `null`, and `null` means UNKNOWN,
 * never "closed". A caller must treat unknown as unconstrained: refusing to
 * move a stop because nobody has recorded its hours would quietly rule out
 * three quarters of the catalogue on the strength of missing data.
 */

/** Day index 0–6, Monday-first, matching how opening hours are written. */
const DAY_INDEX: Record<string, number> = {
  mo: 0, mon: 0, monday: 0,
  tu: 1, tue: 1, tues: 1, tuesday: 1,
  we: 2, wed: 2, wednesday: 2,
  th: 3, thu: 3, thur: 3, thurs: 3, thursday: 3,
  fr: 4, fri: 4, friday: 4,
  sa: 5, sat: 5, saturday: 5,
  su: 6, sun: 6, sunday: 6,
};

/** Minutes since midnight. `to <= from` means the window runs past midnight. */
export interface OpeningWindow {
  from: number;
  to: number;
}

/** When a place is open, per weekday. A day with no windows is a closed day. */
export interface WeekSchedule {
  /** Open around the clock — no windows to check. */
  alwaysOpen: boolean;
  /** day (0=Mon) → the windows it is open that day. */
  byDay: Map<number, OpeningWindow[]>;
}

const toMinutes = (h: string, m: string) => Number(h) * 60 + Number(m);

/** Which weekdays a rule covers, or `null` when the day spec is not understood. */
function parseDays(spec: string): Set<number> | null {
  const text = spec.trim().toLowerCase();
  if (!text || /^(daily|every ?day|shops daily|caf[ée] daily)$/.test(text)) {
    return new Set([0, 1, 2, 3, 4, 5, 6]);
  }

  const days = new Set<number>();
  for (const chunk of text.split(',')) {
    const part = chunk.trim();
    if (!part) continue;
    // "Tu-Su", "Mon–Sat", "Wed–Mon" (wrapping past Sunday is legal and used).
    const range = part.match(/^([a-zçğıöşü]+)\s*[-–]\s*([a-zçğıöşü]+)$/);
    if (range) {
      const from = DAY_INDEX[range[1]];
      const to = DAY_INDEX[range[2]];
      if (from === undefined || to === undefined) return null;
      for (let i = 0; i < 7; i++) {
        const d = (from + i) % 7;
        days.add(d);
        if (d === to) break;
      }
      continue;
    }
    const single = DAY_INDEX[part];
    if (single === undefined) return null;
    days.add(single);
  }
  return days.size ? days : null;
}

/** Every "HH:MM–HH:MM" window in a rule. */
function parseWindows(text: string): OpeningWindow[] {
  const out: OpeningWindow[] = [];
  const re = /(\d{1,2}):(\d{2})\s*[-–]\s*(\d{1,2}):(\d{2})/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    out.push({ from: toMinutes(m[1], m[2]), to: toMinutes(m[3], m[4]) });
  }
  return out;
}

/**
 * Turn an hours string into a week's schedule, or `null` if it cannot be
 * understood. `null` is the answer for "Hours not verified" and for prose,
 * and it means unknown — see the header.
 */
export function parseSchedule(openingHours: string | undefined): WeekSchedule | null {
  if (!openingHours) return null;
  const value = openingHours.trim();
  if (!value || /^hours not verified$/i.test(value)) return null;
  if (/^(always open|open 24 ?hours|24\/7)$/i.test(value)) {
    return { alwaysOpen: true, byDay: new Map() };
  }
  // Prayer times shift daily with the calendar and are not in this dataset,
  // so any place gated on them is unanswerable rather than unrestricted.
  if (/prayer/i.test(value)) return null;

  const byDay = new Map<number, OpeningWindow[]>();
  let sawUsableRule = false;

  for (const rule of value.split(';')) {
    const text = rule.trim();
    if (!text) continue;

    const windows = parseWindows(text);
    if (windows.length === 0) continue; // e.g. "performances evenings"

    // Everything before the first time is the day spec. Parenthetical asides
    // like "(closed Mon)" only restate the range, so they are dropped.
    const daySpec = text
      .slice(0, text.search(/\d{1,2}:\d{2}/))
      .replace(/\(.*$/, '')
      .replace(/[,\s]+$/, '');
    const days = parseDays(daySpec);
    if (days === null) return null; // unknown day names → refuse the whole string

    sawUsableRule = true;
    for (const day of days) {
      byDay.set(day, [...(byDay.get(day) ?? []), ...windows]);
    }
  }

  return sawUsableRule ? { alwaysOpen: false, byDay } : null;
}

/** Is the place open at this instant? Overnight windows run past midnight. */
function openAt(schedule: WeekSchedule, day: number, minutes: number): boolean {
  if (schedule.alwaysOpen) return true;
  const windows = schedule.byDay.get(day);
  if (!windows || windows.length === 0) return false; // a closed day
  return windows.some((w) =>
    w.to <= w.from
      ? minutes >= w.from || minutes < w.to
      : minutes >= w.from && minutes < w.to,
  );
}

/**
 * Can the traveller be here for the whole visit?
 *
 * Both ends are checked, not just arrival: arriving at 17:50 somewhere that
 * shuts at 18:00 is not a visit, it is a locked door ten minutes later. The
 * departure edge is treated as inclusive — leaving exactly at closing time is
 * fine, which is how closing times are actually used.
 *
 * `null` schedule (unknown hours) is the caller's business, not this one's;
 * pass only a parsed schedule here.
 */
export function isOpenThroughout(
  schedule: WeekSchedule,
  day: number,
  arrivalMinutes: number,
  departureMinutes: number,
): boolean {
  if (schedule.alwaysOpen) return true;
  if (!openAt(schedule, day, arrivalMinutes)) return false;
  // A visit ending exactly at closing time is allowed, so the last instant
  // tested is one minute before departure.
  const lastInstant = Math.max(arrivalMinutes, departureMinutes - 1);
  return openAt(schedule, day, lastInstant);
}

/** Whether this weekday is a closed day — a day the schedule has no windows for. */
export function isClosedOn(schedule: WeekSchedule, day: number): boolean {
  if (schedule.alwaysOpen) return false;
  const windows = schedule.byDay.get(day);
  return !windows || windows.length === 0;
}

/**
 * A weekday index the schedule functions understand, 0 = Monday.
 *
 * Takes the caller's value when it is a real weekday, and otherwise answers
 * "today in Istanbul" — not today wherever the server happens to be running.
 * A plan is for a city, and the city is the one whose museums close.
 */
export function normalizeWeekday(weekday: number | undefined): number {
  if (Number.isInteger(weekday) && weekday! >= 0 && weekday! <= 6) {
    return weekday!;
  }
  const name = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Istanbul',
    weekday: 'short',
  }).format(new Date());
  return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(name);
}
