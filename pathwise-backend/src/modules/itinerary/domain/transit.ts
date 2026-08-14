/**
 * How long it really takes to get from one stop to the next.
 *
 * WHY THIS EXISTS
 * The engine used to pick a transport mode from straight-line distance alone:
 * over 3 km was a "ferry", over 1.5 km a "tram", anything else a walk. That is
 * wrong in both directions, and an audit found it wrong on the default path:
 *
 *  - Heybeliada → Büyükada, a crossing between two islands, came out as
 *    "🚋 Tram / short ride (~10 min)".
 *  - Çamlıca Tepesi → Fethi Paşa Korusu, two points inland on the same shore,
 *    came out as "🚢 Ferry (~20 min)" and was charged a boat fare.
 *  - Kadıköy → Büyükada, 17 km of open water, came out as 20 minutes. The real
 *    journey is a scheduled ferry of over an hour plus a long uphill walk.
 *
 * Geometry cannot tell you there is water in the way; only the map can. So the
 * model asks which shore each stop is on and plans accordingly.
 *
 * WHAT THIS IS NOT
 * There is no timetable here. Every wait below is a modelled average, not a
 * departure, and the labels say so — Pathwise plans a day, it does not
 * navigate one. Sourcing live ferry schedules was considered and rejected as
 * disproportionate: it is an external dependency with a freshness obligation
 * and a fare, for a gain the traveller gets more reliably from a transit app.
 * What the engine owes the user is a plan that is *possible*, and that only
 * needs honest estimates.
 */
import { HubSide } from '../../places/domain/hub';
import { haversineMeters } from './geo';
import { TransportLeg } from './itinerary';

/** A stop as the transit model sees it — geography, not content. */
export interface TransitPoint {
  name: string;
  lat: number;
  lng: number;
  side: HubSide;
  /**
   * Which island, for `Islands` points. Büyükada and Heybeliada are separated
   * by water and a sailing; without this the model cannot tell a hop between
   * them from a walk across one of them, because they overlap in distance.
   */
  island?: string;
}

// ── Modelled constants ───────────────────────────────────────────────
// Deliberately few, and every one of them an estimate we are willing to
// defend out loud. They round generously: a plan that leaves slack is
// recoverable, a plan that runs late strands someone.

/** Beyond this, people stop walking and take something. ~16 min on foot. */
const WALK_LIMIT_M = 1200;
const WALK_SPEED_M_PER_MIN = 75; // ~4.5 km/h

/** Door-to-door average for tram/metro/bus in Istanbul traffic, ~15 km/h. */
const LAND_SPEED_M_PER_MIN = 250;
/** Getting to the stop and waiting for the vehicle. */
const LAND_OVERHEAD_MIN = 8;

/** Walking to the pier at one end. Counted at both ends of every crossing. */
const PIER_ACCESS_MIN = 12;

/** Bosphorus commuter ferries are frequent; the islands run is not. */
const BOSPHORUS_WAIT_MIN = 15;
const BOSPHORUS_CROSSING_MIN = 20;
const INTER_ISLAND_WAIT_MIN = 25;
const INTER_ISLAND_CROSSING_MIN = 15;
const ISLAND_WAIT_MIN = 30;
const ISLAND_CROSSING_MIN = 75;

/**
 * The Adalar rules the engine enforces, kept here beside the numbers they
 * depend on.
 *
 * `LAST_FERRY_MIN` is a conservative floor, not a departure: winter timetables
 * thin out well before the summer ones do, and being an hour early for a boat
 * costs a traveller nothing next to missing the last one.
 */
export const ISLAND_LAST_FERRY_MIN = 20 * 60; // 20:00
/** Getting down to the pier and boarding, from wherever the day ends. */
export const ISLAND_RETURN_BUFFER_MIN = 45;

const round5 = (n: number) => Math.round(n / 5) * 5;

/** Are these two stops on opposite sides of water? */
function crossesWater(a: TransitPoint, b: TransitPoint): boolean {
  if (a.side !== b.side) return true;
  if (a.side !== 'Islands') return false;
  // Same island → land. Unknown island on either end → fall back to distance,
  // which is the old heuristic but only ever reached inside the archipelago.
  if (a.island && b.island) return a.island !== b.island;
  return haversineMeters(a, b) > 1500;
}

/**
 * Plan the leg between two consecutive stops.
 *
 * Durations are door-to-door: a ferry leg includes walking to the pier, the
 * modelled wait, the crossing and the walk off at the other end, because that
 * is the time the traveller's day actually loses.
 */
export function planLeg(from: TransitPoint, to: TransitPoint): TransportLeg {
  const distanceMeters = Math.round(haversineMeters(from, to));

  if (crossesWater(from, to)) {
    const island =
      from.side === 'Islands' || to.side === 'Islands'
        ? from.side === to.side
          ? { wait: INTER_ISLAND_WAIT_MIN, crossing: INTER_ISLAND_CROSSING_MIN }
          : { wait: ISLAND_WAIT_MIN, crossing: ISLAND_CROSSING_MIN }
        : { wait: BOSPHORUS_WAIT_MIN, crossing: BOSPHORUS_CROSSING_MIN };

    const durationMinutes = round5(
      PIER_ACCESS_MIN * 2 + island.wait + island.crossing,
    );
    return {
      mode: 'ferry',
      // The breakdown is in the label on purpose. "~2 h" on a 17 km hop reads
      // like an error; "~2 h incl. ~30 min wait" reads like a plan.
      label: `🚢 Ferry to ${to.name} (~${durationMinutes} min incl. pier + ~${island.wait} min wait)`,
      distanceMeters,
      durationMinutes,
    };
  }

  if (distanceMeters > WALK_LIMIT_M) {
    const durationMinutes = round5(
      distanceMeters / LAND_SPEED_M_PER_MIN + LAND_OVERHEAD_MIN,
    );
    return {
      // 'bus' stands for surface transit generally — the model knows there is
      // no water in the way, not which line you will take.
      mode: 'bus',
      // Private cars are banned on the Princes' Islands, so offering someone a
      // tram or a metro there is the same class of error as the ferries this
      // model exists to fix. Electric shuttles and bicycles are what run.
      label:
        to.side === 'Islands'
          ? `🚲 Island shuttle / bike to ${to.name} (~${durationMinutes} min)`
          : `🚌 Tram / metro / bus to ${to.name} (~${durationMinutes} min)`,
      distanceMeters,
      durationMinutes,
    };
  }

  const durationMinutes = Math.max(
    2,
    Math.round(distanceMeters / WALK_SPEED_M_PER_MIN),
  );
  return {
    mode: 'walk',
    label: `🚶 ${durationMinutes} min walk (${distanceMeters}m)`,
    distanceMeters,
    durationMinutes,
  };
}
