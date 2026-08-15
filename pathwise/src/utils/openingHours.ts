/**
 * "Open now / Closed / Closes at 18:00", from the human-readable hours string.
 *
 * Two rules govern everything here.
 *
 * ISTANBUL TIME, ALWAYS. The question "is it open?" is about a door in
 * Istanbul, not about the clock on the reader's laptop. Someone planning from
 * Berlin must see the same answer as someone standing outside, so the current
 * time is read in `Europe/Istanbul` regardless of the device.
 *
 * SILENCE WHEN UNSURE. The dataset holds free prose as well as schedules —
 * "Daily, outside prayer times", "Lobby daily; performances evenings" — and
 * most places carry no verified hours at all. Anything this parser cannot
 * resolve returns `null`, and `null` renders nothing. A wrong "Open now" sends
 * someone across the city to a locked door, which is far worse than a card
 * that stays quiet.
 */

const TZ = 'Europe/Istanbul';

/** Day index 0–6, Monday-first, to match the way opening hours are written. */
const DAY_INDEX: Record<string, number> = {
  mo: 0, mon: 0, monday: 0,
  tu: 1, tue: 1, tues: 1, tuesday: 1,
  we: 2, wed: 2, wednesday: 2,
  th: 3, thu: 3, thur: 3, thurs: 3, thursday: 3,
  fr: 4, fri: 4, friday: 4,
  sa: 5, sat: 5, saturday: 5,
  su: 6, sun: 6, sunday: 6,
};

export interface OpenStatus {
  open: boolean;
  /** "HH:MM" the place closes, when it is open and the time is known. */
  closesAt?: string;
}

/** Current wall-clock time in Istanbul: minutes since midnight + weekday. */
export function istanbulNow(now: Date = new Date()): {
  minutes: number;
  day: number;
} {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ,
    hour: '2-digit',
    minute: '2-digit',
    weekday: 'short',
    hour12: false,
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  const hour = Number(get('hour'));
  const minute = Number(get('minute'));
  const day = DAY_INDEX[get('weekday').toLowerCase()] ?? 0;
  return { minutes: hour * 60 + minute, day };
}

const toMinutes = (h: string, m: string) => Number(h) * 60 + Number(m);

/**
 * Which weekdays a rule applies to, or `null` if the day spec is not
 * understood. An empty/`Daily` spec means every day.
 */
function parseDays(spec: string): Set<number> | null {
  const text = spec.trim().toLowerCase();
  if (!text || /^(daily|every ?day|shops daily|caf[ée] daily)$/.test(text)) {
    return new Set([0, 1, 2, 3, 4, 5, 6]);
  }

  const days = new Set<number>();
  for (const chunk of text.split(',')) {
    const part = chunk.trim();
    if (!part) continue;
    // "Tu-Su", "Mon–Sat", "Wed–Mon" (wrapping past Sunday is legal and used)
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

/** Every "HH:MM–HH:MM" window in a rule. Empty when the rule has no times. */
function parseWindows(text: string): { from: number; to: number }[] {
  const out: { from: number; to: number }[] = [];
  const re = /(\d{1,2}):(\d{2})\s*[-–]\s*(\d{1,2}):(\d{2})/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    out.push({ from: toMinutes(m[1], m[2]), to: toMinutes(m[3], m[4]) });
  }
  return out;
}

export function openStatus(
  openingHours: string | undefined,
  now: Date = new Date(),
): OpenStatus | null {
  if (!openingHours) return null;
  const value = openingHours.trim();
  if (!value || /^hours not verified$/i.test(value)) return null;
  if (/^(always open|open 24 ?hours|24\/7)$/i.test(value)) return { open: true };

  // Prose we cannot turn into a schedule. Prayer times shift daily with the
  // calendar and are not in this dataset, so any place gated on them is
  // unanswerable here — better silent than confidently wrong.
  if (/prayer/i.test(value)) return null;

  const { minutes, day } = istanbulNow(now);
  let sawUsableRule = false;
  let closesAt: number | null = null;

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
    if (!days.has(day)) continue;

    for (const w of windows) {
      // An overnight window ("16:00–02:00") runs past midnight.
      const overnight = w.to <= w.from;
      const isOpen = overnight
        ? minutes >= w.from || minutes < w.to
        : minutes >= w.from && minutes < w.to;
      if (isOpen) {
        closesAt = w.to;
        break;
      }
    }
    if (closesAt !== null) break;
  }

  if (!sawUsableRule) return null;
  if (closesAt === null) return { open: false };

  const hh = String(Math.floor(closesAt / 60) % 24).padStart(2, '0');
  const mm = String(closesAt % 60).padStart(2, '0');
  return { open: true, closesAt: `${hh}:${mm}` };
}

/** Show the closing time only when it is close enough to matter. */
export const CLOSING_SOON_MINUTES = 90;

export function closingSoon(
  status: OpenStatus | null,
  now: Date = new Date(),
): boolean {
  if (!status?.open || !status.closesAt) return false;
  const [h, m] = status.closesAt.split(':').map(Number);
  const closes = h * 60 + m;
  const { minutes } = istanbulNow(now);
  const left = closes > minutes ? closes - minutes : closes + 24 * 60 - minutes;
  return left <= CLOSING_SOON_MINUTES;
}
