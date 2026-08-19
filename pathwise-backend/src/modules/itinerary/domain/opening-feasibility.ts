import { Place } from '../../places/domain/place';
import {
  isClosedOn,
  isOpenThroughout,
  parseSchedule,
  type WeekSchedule,
} from '../../places/domain/opening-hours';

/**
 * Keep the generated day off locked doors.
 *
 * WHAT WAS WRONG
 * The route engine ordered stops purely by geography and cost, and then walked
 * them with a clock. Nothing consulted opening hours, so it would cheerfully
 * schedule Kadıköy Barlar Sokağı — a bar street that opens at 16:00 — for
 * 12:51, every day of the week. Measured across the golden cases it also put
 * the Museum of Turkish & Islamic Arts, Istanbul Modern and SALT Galata into
 * Mondays they are closed, and the Grand Bazaar into a Sunday.
 *
 * WHAT THIS DOES
 * Two repairs, in the order that damages the route least:
 *
 *  1. DEFER. A place that is shut when we would arrive, but open later that
 *     day, is moved further down the day. This is almost always the right fix
 *     and costs nothing: a bar belongs at the end of the day anyway, and the
 *     order it came in was geographic, not chronological.
 *
 *  2. DROP. A place shut for the whole day — a Monday museum — cannot be
 *     visited at any hour, so it leaves the day entirely. So does one that
 *     defer could not rescue and that would need more than `maxWait` minutes
 *     of standing outside. A shorter day is not a worse day than one with a
 *     locked door in the middle of it.
 *
 * A SMALL WAIT IS ALLOWED
 * Arriving at 15:40 somewhere that opens at 16:00 is a coffee, not a defect,
 * so waits up to `maxWait` are kept and reported. The caller applies them —
 * this function only decides the order and the survivors.
 *
 * UNKNOWN HOURS ARE NOT CLOSED
 * Three quarters of the catalogue has no opening-hours string at all. Those
 * places are left exactly where they are. Guessing "probably shut" would empty
 * the day on missing data, which is a worse failure than the one being fixed.
 */

export interface FeasibilityInput {
  /** The day's places, in the order the engine chose. */
  ordered: Place[];
  /** Minutes since midnight when the day begins. */
  startMinutes: number;
  /** 0 = Monday, matching parseSchedule. */
  weekday: number;
  /** Travel time between two consecutive stops, in minutes. */
  travelMinutes: (from: Place, to: Place) => number;
  /** How long a traveller may reasonably wait for a door to open. */
  maxWaitMinutes?: number;
}

export interface FeasibilityResult {
  ordered: Place[];
  /** Places removed because they are shut whenever the day could reach them. */
  dropped: { place: Place; reason: 'closed-all-day' | 'never-open-in-time' }[];
  /** placeId → minutes the traveller waits for opening, where non-zero. */
  waits: Map<string, number>;
}

const DEFAULT_MAX_WAIT = 45;

/** The parsed schedule for a place, or null when it has none worth trusting. */
export function scheduleFor(place: Place): WeekSchedule | null {
  return parseSchedule(place.openingHours);
}

/**
 * When this place could next be entered at or after `from`, or null if it
 * cannot be entered that day at all. Returns `from` itself when already open.
 */
function opensAt(
  schedule: WeekSchedule,
  weekday: number,
  from: number,
  visitMinutes: number,
): number | null {
  if (schedule.alwaysOpen) return from;
  const windows = schedule.byDay.get(weekday);
  if (!windows || windows.length === 0) return null;

  let best: number | null = null;
  for (const w of windows) {
    // `to <= from` marks a window that runs past midnight (16:00–02:00). Its
    // entry is still governed by `from`, and it has no same-day end to miss.
    const overnight = w.to <= w.from;
    const candidate = Math.max(from, w.from);
    if (!overnight && candidate >= w.to) continue; // this window is already over
    if (!isOpenThroughout(schedule, weekday, candidate, candidate + visitMinutes)) {
      continue; // the visit would run past closing
    }
    if (best === null || candidate < best) best = candidate;
  }
  return best;
}

export function respectOpeningHours(input: FeasibilityInput): FeasibilityResult {
  const maxWait = input.maxWaitMinutes ?? DEFAULT_MAX_WAIT;
  const waits = new Map<string, number>();
  const dropped: FeasibilityResult['dropped'] = [];

  // Places shut all day never enter the scheduling loop: no ordering saves
  // them, and leaving them in only to remove them later muddies the reason.
  const survivors: Place[] = [];
  for (const place of input.ordered) {
    const schedule = scheduleFor(place);
    if (schedule && isClosedOn(schedule, input.weekday)) {
      dropped.push({ place, reason: 'closed-all-day' });
      continue;
    }
    survivors.push(place);
  }

  const remaining = [...survivors];
  const result: Place[] = [];
  let clock = input.startMinutes;
  let previous: Place | null = null;

  while (remaining.length > 0) {
    let chosenIndex = -1;
    let chosenArrival = 0;

    // Prefer the earliest place in the engine's order that is open when we
    // could get there — that keeps the geography it worked out. Only when
    // nothing is open do we consider waiting.
    let fallbackIndex = -1;
    let fallbackArrival = Infinity;

    for (let i = 0; i < remaining.length; i++) {
      const place = remaining[i];
      const arrival =
        clock + (previous ? input.travelMinutes(previous, place) : 0);
      const schedule = scheduleFor(place);

      // No hours on record → treat as available, and take it in order.
      if (!schedule) {
        chosenIndex = i;
        chosenArrival = arrival;
        break;
      }

      const open = opensAt(schedule, input.weekday, arrival, place.avgVisitMinutes);
      if (open === null) continue; // cannot be fitted after this point today

      if (open <= arrival) {
        chosenIndex = i;
        chosenArrival = arrival;
        break;
      }
      if (open < fallbackArrival) {
        fallbackArrival = open;
        fallbackIndex = i;
      }
    }

    if (chosenIndex === -1) {
      // Nothing is open right now. Take the one that opens soonest, if the
      // wait is one a person would actually accept.
      if (fallbackIndex === -1) {
        // Everything left is unreachable today — the day ends here.
        for (const place of remaining) {
          dropped.push({ place, reason: 'never-open-in-time' });
        }
        break;
      }
      const place = remaining[fallbackIndex];
      const arrival =
        clock + (previous ? input.travelMinutes(previous, place) : 0);
      const wait = fallbackArrival - arrival;
      if (wait > maxWait) {
        dropped.push({ place, reason: 'never-open-in-time' });
        remaining.splice(fallbackIndex, 1);
        continue;
      }
      waits.set(place.placeId, wait);
      chosenIndex = fallbackIndex;
      chosenArrival = fallbackArrival;
    }

    const place = remaining[chosenIndex];
    remaining.splice(chosenIndex, 1);
    result.push(place);
    clock = chosenArrival + place.avgVisitMinutes;
    previous = place;
  }

  return { ordered: result, dropped, waits };
}
