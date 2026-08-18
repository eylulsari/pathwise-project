import { Place } from '../../places/domain/place';
import {
  isOpenThroughout,
  parseSchedule,
  WeekSchedule,
} from '../../places/domain/opening-hours';
import { planLeg, TransitPoint } from './transit';
import { HubSide } from '../../places/domain/hub';

/**
 * Reorder a day's stops to spend less of it in transit.
 *
 * WHAT THIS OPTIMISES
 * Travel time between stops, and nothing else. Visit durations are a property
 * of the places, not of their order, so they are the same in every candidate
 * and cancel out — reporting a "saving" that included them would inflate the
 * number with time the traveller was always going to spend.
 *
 * WHAT IT REFUSES TO BREAK
 *  - A pinned reservation keeps its position. Its time is a fact about the
 *    outside world, and an optimiser that reorders around it is rescheduling
 *    someone's booking for them.
 *  - A stop with known opening hours must still be open when the new order
 *    puts the traveller there, and on that weekday.
 *
 * WHAT IT CANNOT PROMISE, AND WHY THE UI MUST SAY SO
 * 145 of 202 places in the dataset carry "Hours not verified". Unknown hours
 * are treated as unconstrained, because the alternative — refusing to move
 * anything whose hours nobody recorded — would rule out three quarters of the
 * catalogue on the strength of missing data. So a feasible order here means
 * "nothing KNOWN is violated", not "everything is open". `constrainedStops`
 * reports how many stops actually had hours to check, so the interface can
 * describe the guarantee it really made instead of implying a stronger one.
 *
 * THE SEARCH
 * Nearest-neighbour for a starting order, then 2-opt until no improving swap
 * remains. Days are short — the engine caps a day well below twenty stops — so
 * this settles in microseconds, and it is deterministic: the same day always
 * produces the same suggestion, which matters for a button someone may press
 * twice.
 */

/** A stop as the optimiser sees it. */
export interface OptimizableStop {
  place: Place;
  side: HubSide;
  /** Fixed position — a pinned booking. Never moved. */
  pinned: boolean;
}

export interface OptimizeResult {
  /** The suggested order, as place ids. */
  order: string[];
  /** Total transit minutes before and after. */
  beforeMinutes: number;
  afterMinutes: number;
  /** How many stops changed position. Zero means the day was already good. */
  movedStops: number;
  /** How many stops had opening hours that could actually be checked. */
  constrainedStops: number;
  /** How many stops stayed put because a booking pinned them. */
  pinnedStops: number;
}

interface Node {
  stop: OptimizableStop;
  point: TransitPoint;
  schedule: WeekSchedule | null;
}

const legMinutes = (a: Node, b: Node): number =>
  planLeg(a.point, b.point).durationMinutes;

/** Total transit time of an order — the quantity being minimised. */
function travelMinutes(order: Node[]): number {
  let total = 0;
  for (let i = 0; i < order.length - 1; i++) {
    total += legMinutes(order[i], order[i + 1]);
  }
  return total;
}

/**
 * How many stops this order would send the traveller to while they are shut.
 *
 * A COUNT, not a yes/no, and that distinction is the whole design.
 *
 * The route generator does not consult opening hours at all, so the day handed
 * to this optimiser is often already impossible — a real generated Kadıköy day
 * puts Barlar Sokağı ("Daily 16:00–02:00") at 13:53, and no reordering of a
 * plan that ends at 15:19 can fix that. Demanding a perfectly feasible result
 * meant one unsatisfiable stop rejected every candidate and the optimiser
 * silently did nothing, on days it could have shortened by a third.
 *
 * So the rule is "introduce no NEW violations" rather than "be perfect": a
 * candidate is allowed when it breaks no more than the day already broke. That
 * still makes it impossible for optimising to close a door that was open, and
 * it stops one bad stop from freezing the rest of the day.
 *
 * This mirrors assembly's timing (visit, then travel to the next) closely
 * enough to judge. It deliberately does NOT model the automatic lunch break:
 * lunch shifts everything after it by the same amount in every candidate, so
 * including it would change which orders pass on a detail identical across
 * them, and assembly re-times the day properly once an order is chosen.
 */
function violations(
  order: Node[],
  startMinutes: number,
  weekday: number,
): number {
  let clock = startMinutes;
  let broken = 0;
  for (let i = 0; i < order.length; i++) {
    const node = order[i];
    const arrival = clock;
    const departure = arrival + node.stop.place.avgVisitMinutes;

    if (node.schedule && !isOpenThroughout(node.schedule, weekday, arrival, departure)) {
      broken++;
    }

    clock = departure;
    const next = order[i + 1];
    if (next) clock += legMinutes(node, next);
  }
  return broken;
}

/** Greedy nearest-neighbour from the first stop, which anchors the day. */
function nearestNeighbour(nodes: Node[]): Node[] {
  if (nodes.length <= 2) return [...nodes];
  const remaining = nodes.slice(1);
  const out = [nodes[0]];
  while (remaining.length > 0) {
    const last = out[out.length - 1];
    let bestIndex = 0;
    let bestCost = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const cost = legMinutes(last, remaining[i]);
      // Strictly-less keeps this deterministic on ties: the earlier candidate
      // wins, so equal-distance stops never reorder run to run.
      if (cost < bestCost) {
        bestCost = cost;
        bestIndex = i;
      }
    }
    out.push(remaining.splice(bestIndex, 1)[0]);
  }
  return out;
}

/**
 * 2-opt: reverse each segment in turn, keep any reversal that is both shorter
 * and still feasible. Repeats until a full pass finds no improvement.
 */
function twoOpt(
  start: Node[],
  startMinutes: number,
  weekday: number,
  pinnedAt: Map<number, Node>,
  violationBudget: number,
): Node[] {
  let best = start;
  let bestCost = travelMinutes(best);
  let improved = true;

  // Bounded so a pathological day cannot spin: each pass is O(n²) and n is
  // small, but a guarantee beats a reassurance.
  for (let pass = 0; pass < 20 && improved; pass++) {
    improved = false;
    for (let i = 0; i < best.length - 1; i++) {
      for (let k = i + 1; k < best.length; k++) {
        const candidate = [
          ...best.slice(0, i),
          ...best.slice(i, k + 1).reverse(),
          ...best.slice(k + 1),
        ];
        if (!respectsPins(candidate, pinnedAt)) continue;
        const cost = travelMinutes(candidate);
        if (cost >= bestCost) continue;
        // No new closed doors. Equal is allowed so a day that already had one
        // impossible stop can still be shortened around it.
        if (violations(candidate, startMinutes, weekday) > violationBudget) continue;
        best = candidate;
        bestCost = cost;
        improved = true;
      }
    }
  }
  return best;
}

/** Every pinned stop must still sit at the index its booking fixed it to. */
function respectsPins(order: Node[], pinnedAt: Map<number, Node>): boolean {
  for (const [index, node] of pinnedAt) {
    if (order[index] !== node) return false;
  }
  return true;
}

/**
 * Suggest a better order, or the original one when nothing better is feasible.
 *
 * Returning the input unchanged is a real answer, not a failure: a day that is
 * already efficient should say so rather than shuffle stops to look busy.
 */
export function optimizeOrder(
  stops: OptimizableStop[],
  startMinutes: number,
  weekday: number,
): OptimizeResult {
  const nodes: Node[] = stops.map((stop) => ({
    stop,
    point: {
      name: stop.place.name,
      lat: stop.place.lat,
      lng: stop.place.lng,
      side: stop.side,
      island: stop.place.neighborhood,
    },
    schedule: parseSchedule(stop.place.openingHours),
  }));

  const constrainedStops = nodes.filter((n) => n.schedule !== null).length;
  const pinnedStops = stops.filter((s) => s.pinned).length;
  const beforeMinutes = travelMinutes(nodes);

  const unchanged: OptimizeResult = {
    order: stops.map((s) => s.place.placeId),
    beforeMinutes,
    afterMinutes: beforeMinutes,
    movedStops: 0,
    constrainedStops,
    pinnedStops,
  };

  // Two stops have exactly one order worth considering, and one has none.
  if (nodes.length < 3) return unchanged;

  const pinnedAt = new Map<number, Node>();
  nodes.forEach((node, i) => {
    if (node.stop.pinned) pinnedAt.set(i, node);
  });

  // What the day already breaks. Every candidate is measured against this, so
  // optimising can never add a closed door — see the note on `violations`.
  const violationBudget = violations(nodes, startMinutes, weekday);

  const neighbourOrder = nearestNeighbour(nodes);
  const seed = respectsPins(neighbourOrder, pinnedAt) ? neighbourOrder : nodes;
  // A greedy seed that breaks more than the day already did would let 2-opt
  // improve from somewhere worse than where it started.
  const start =
    violations(seed, startMinutes, weekday) <= violationBudget ? seed : nodes;

  const best = twoOpt(start, startMinutes, weekday, pinnedAt, violationBudget);
  const afterMinutes = travelMinutes(best);

  // Never hand back something worse or merely equal — a reshuffle that saves
  // nothing is churn, and it would make the undo button the only useful part.
  if (afterMinutes >= beforeMinutes) return unchanged;

  const movedStops = best.reduce(
    (count, node, i) => (node === nodes[i] ? count : count + 1),
    0,
  );

  return {
    order: best.map((n) => n.stop.place.placeId),
    beforeMinutes,
    afterMinutes,
    movedStops,
    constrainedStops,
    pinnedStops,
  };
}
