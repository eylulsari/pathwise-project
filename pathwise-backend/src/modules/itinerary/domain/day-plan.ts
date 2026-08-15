import { Hub } from '../../places/domain/place';
import { HubMeta, HubSide } from '../../places/domain/hub';

/**
 * Which neighbourhood each day of a trip is built around.
 *
 * The dashboard used to ship three hardcoded days — Kadıköy, Karaköy, Balat —
 * with no way to ask for more or fewer. Letting someone pick a length turns
 * "which hub is day 4?" into a real question, and answering it badly is worse
 * than not asking: repeating a hub means repeating its places, because each day
 * is generated from one hub's pool.
 *
 * Three rules, in priority order:
 *
 * 1. **Never the same hub twice.** With ten hubs and a seven-day maximum this
 *    always holds, so no traveller ever sees a day they have already walked.
 * 2. **Alternate shores.** Two Bosphorus crossings back to back is a lot of
 *    ferry for one trip; spreading them means the transit model's honest hour
 *    lands where it is worth paying.
 * 3. **The islands need room.** Adalar is a ninety-minute sailing each way and
 *    the engine already treats it as a day of its own. Spending one of only two
 *    days on it is a poor trade, so it is held back until a trip is long
 *    enough to afford it.
 */

/** Adalar is only worth a day when the trip has days to spare. */
const ISLANDS_MIN_TRIP_DAYS = 3;

export const MIN_TRIP_DAYS = 1;
/** A week is the practical ceiling for one city, and ten hubs cover it. */
export const MAX_TRIP_DAYS = 7;

export function planHubSequence(days: number, hubs: HubMeta[]): Hub[] {
  const wanted = Math.max(0, Math.floor(days));
  if (wanted === 0 || hubs.length === 0) return [];

  const eligible =
    wanted >= ISLANDS_MIN_TRIP_DAYS
      ? hubs
      : hubs.filter((h) => h.side !== 'Islands');

  // Pools keyed by side, each in dataset order (which runs geographically).
  const pools = new Map<HubSide, HubMeta[]>();
  for (const hub of eligible) {
    const pool = pools.get(hub.side) ?? [];
    pool.push(hub);
    pools.set(hub.side, pool);
  }

  const sequence: Hub[] = [];
  let previousSide: HubSide | null = null;

  for (let day = 0; day < wanted; day++) {
    const side = pickSide(pools, previousSide);
    if (side === null) {
      // Fewer hubs than days. Unreachable through the UI — ten hubs against a
      // seven-day cap — but a total function beats a crash if the dataset ever
      // shrinks. Restart the rotation rather than stall, and never immediately
      // after the same hub.
      const restart = eligible.filter((h) => h.id !== sequence[sequence.length - 1]);
      sequence.push((restart[day % restart.length] ?? eligible[0]).id);
      previousSide = null;
      continue;
    }
    const pool = pools.get(side)!;
    const hub = pool.shift()!;
    if (pool.length === 0) pools.delete(side);
    sequence.push(hub.id);
    previousSide = side;
  }

  return sequence;
}

/**
 * The side with the most hubs left, skipping the one used yesterday.
 *
 * Taking from the largest pool is what keeps the alternation going: draining
 * the small side first would strand a run of same-side days at the end, which
 * is exactly the shape the rule exists to avoid.
 */
function pickSide(
  pools: Map<HubSide, HubMeta[]>,
  previousSide: HubSide | null,
): HubSide | null {
  const candidates = [...pools.entries()]
    .filter(([, pool]) => pool.length > 0)
    .sort((a, b) => b[1].length - a[1].length);
  if (candidates.length === 0) return null;

  const different = candidates.find(([side]) => side !== previousSide);
  // Only one side left with anything in it — a same-side day beats no day.
  return (different ?? candidates[0])[0];
}
