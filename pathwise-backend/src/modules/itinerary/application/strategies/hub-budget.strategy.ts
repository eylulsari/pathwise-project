import { Injectable } from '@nestjs/common';
import { PlacesService } from '../../../places/application/places.service';
import { Hub, Place } from '../../../places/domain/place';
import { haversineMeters, LatLng } from '../../domain/geo';
import {
  GroupType,
  Itinerary,
  ItineraryStop,
  RouteGenerationInput,
  TransportLeg,
} from '../../domain/itinerary';
import { RouteGenerationStrategy } from '../../domain/route-generation-strategy.port';

/**
 * HubBudgetStrategy — the core route engine.
 *
 * Pipeline:
 *   1. gather candidates (hub places + any must-visits from other hubs)
 *   2. score by interest match + rating + group fit
 *   3. greedily select within the time (pace) budget; must-visits are forced
 *      in and are NEVER dropped, even if the money budget is strained
 *   4. weather pass: on rain, swap outdoor non-must stops for indoor ones
 *   5. order by nearest-neighbour; push sunset spots to the end in the evening
 *   6. insert an automatic Lunch Break if the day spans midday
 *   7. compute transport legs, arrival/departure times and the cost breakdown
 */
@Injectable()
export class HubBudgetStrategy implements RouteGenerationStrategy {
  private static readonly LUNCH_START = 12 * 60; // minutes since midnight
  private static readonly LUNCH_END = 14 * 60;
  private static readonly LUNCH_DURATION = 45;
  private static readonly WALK_SPEED_M_PER_MIN = 75; // ~4.5 km/h

  /**
   * Upper bound on real stops in a day, by pace.
   *
   * Until the dataset grew to 129 places this was unnecessary: a hub held five
   * or six candidates whose visit times summed to less than any sane pace
   * budget, so "everything that fits" and "everything" were the same set. With
   * twelve to fifteen candidates per hub the time budget alone will pack a
   * seven-hour day with ten or more stops — arithmetically valid and a
   * miserable day to actually walk. The cap is what keeps a plan human;
   * `paceHours` remains the binding constraint whenever it is the tighter one.
   *
   * Must-visits and reservations are exempt — the user asked for those
   * explicitly, and silently dropping a booked stop would be a bug, not pacing.
   */
  private static readonly MAX_STOPS_BY_PACE: ReadonlyArray<{
    upToHours: number;
    maxStops: number;
  }> = [
    { upToHours: 3, maxStops: 3 }, // "relaxed"
    { upToHours: 5, maxStops: 5 }, // "moderate"
    { upToHours: 7, maxStops: 7 }, // "packed"
    { upToHours: Infinity, maxStops: 8 },
  ];

  private static maxStopsFor(paceHours: number): number {
    return (
      HubBudgetStrategy.MAX_STOPS_BY_PACE.find((b) => paceHours <= b.upToHours)
        ?.maxStops ?? 8
    );
  }

  constructor(private readonly places: PlacesService) {}

  async generate(input: RouteGenerationInput): Promise<Itinerary> {
    const hub = input.hub ?? 'kadikoy-moda';

    // 1 — candidate pool: hub places + must-visits from anywhere.
    // Reserved stops are treated like must-visits: a booking means you're going,
    // so they're force-included and never dropped for budget/pace.
    const reservedIds = (input.reservations ?? []).map((r) => r.placeId);
    const forcedIds = [...input.mustVisitIds, ...reservedIds];
    const hubPlaces = await this.places.findByHub(hub);
    const forced = forcedIds.length ? await this.places.findByIds(forcedIds) : [];
    const pool = this.dedupe([...forced, ...hubPlaces]);
    const mustSet = new Set(forcedIds);

    // 2 — score and sort (must-visits always float to the top).
    const scored = pool
      .map((p) => ({ place: p, score: this.score(p, input, mustSet) }))
      .sort((a, b) => b.score - a.score);

    // 3 — greedy selection within the time budget AND the stop cap.
    const timeBudget = input.paceHours * 60;
    const maxStops = HubBudgetStrategy.maxStopsFor(input.paceHours);
    let usedMinutes = 0;
    const selected: Place[] = [];
    // Force must-visits in first (never dropped, never counted against the cap).
    for (const { place } of scored) {
      if (mustSet.has(place.placeId)) {
        selected.push(place);
        usedMinutes += place.avgVisitMinutes;
      }
    }
    for (const { place } of scored) {
      if (mustSet.has(place.placeId)) continue;
      if (selected.length >= maxStops) break;
      // `continue`, not `break`: a long stop that misses the budget must not
      // stop us considering the shorter, lower-scoring ones behind it.
      if (usedMinutes + place.avgVisitMinutes > timeBudget) continue;
      selected.push(place);
      usedMinutes += place.avgVisitMinutes;
    }

    // 4 — weather pass: on rain, replace outdoor non-must stops with indoor
    //     alternatives from the same hub (keeps you in the neighborhood).
    const weatherAdjusted =
      input.weather === 'rainy'
        ? this.swapForIndoor(selected, hubPlaces, mustSet)
        : selected;

    // 5 — order geographically; sunset spots pushed to the end in the evening.
    const ordered = this.orderStops(weatherAdjusted, input);

    // 6 & 7 — build timed stops, lunch break, transport legs and costs.
    return this.assemble(ordered, input, hub);
  }

  // ── scoring ──────────────────────────────────────────────────────

  private score(
    place: Place,
    input: RouteGenerationInput,
    mustSet: Set<string>,
  ): number {
    if (mustSet.has(place.placeId)) return Number.MAX_SAFE_INTEGER;

    let score = place.rating * 10; // base quality signal (Google rating)

    // Interest overlap is the strongest lever.
    const overlap = place.interests.filter((i) =>
      input.interests.includes(i),
    ).length;
    score += overlap * 25;

    // Group fit — friends lean nightlife/markets, couples lean sunset/food,
    // solo travelers get a small bump on safe, walkable culture stops.
    score += this.groupBonus(place, input.group);

    // Gently penalize expensive tickets when the budget is tight.
    if (place.entryFeeTry > input.budgetTry * 0.25) score -= 15;

    return score;
  }

  private groupBonus(place: Place, group: GroupType): number {
    switch (group) {
      case 'friends':
        return place.interests.includes('food') ||
          place.interests.includes('market')
          ? 12
          : 0;
      case 'couple':
        return place.isSunsetSpot || place.interests.includes('food') ? 12 : 0;
      case 'solo':
        return place.interests.includes('history') ||
          place.interests.includes('art')
          ? 8
          : 0;
    }
  }

  // ── weather swap ─────────────────────────────────────────────────

  private swapForIndoor(
    selected: Place[],
    hubPlaces: Place[],
    mustSet: Set<string>,
  ): Place[] {
    const chosenIds = new Set(selected.map((p) => p.placeId));
    const indoorAlternatives = hubPlaces
      .filter((p) => p.isIndoor && !chosenIds.has(p.placeId))
      .sort((a, b) => b.rating - a.rating);

    return selected.map((p) => {
      if (p.isIndoor || mustSet.has(p.placeId)) return p;
      const swap = indoorAlternatives.shift();
      return swap ?? p; // keep original if no indoor option remains
    });
  }

  // ── ordering ─────────────────────────────────────────────────────

  private orderStops(places: Place[], input: RouteGenerationInput): Place[] {
    if (places.length <= 1) return places;

    // Seed the nearest-neighbour tour from the start origin if given, otherwise
    // the northern-most stop so the walk reads naturally. (A real build would
    // call OSRM for a true optimized route.)
    const remaining = [...places];
    const startAnchor: LatLng =
      input.startOrigin ?? remaining.reduce((a, b) => (a.lat > b.lat ? a : b));

    // First stop = the place nearest the start anchor.
    let firstIdx = 0;
    let firstDist = Infinity;
    remaining.forEach((p, i) => {
      const d = haversineMeters(startAnchor, p);
      if (d < firstDist) {
        firstDist = d;
        firstIdx = i;
      }
    });
    const tour: Place[] = [remaining[firstIdx]];
    remaining.splice(firstIdx, 1);

    while (remaining.length) {
      const last = tour[tour.length - 1];
      let nearestIdx = 0;
      let nearestDist = Infinity;
      remaining.forEach((p, i) => {
        const d = haversineMeters(last, p);
        if (d < nearestDist) {
          nearestDist = d;
          nearestIdx = i;
        }
      });
      tour.push(remaining[nearestIdx]);
      remaining.splice(nearestIdx, 1);
    }

    // Time anchors (mid-stop pinning A2 / reservations): pinned stops keep their
    // fixed times and act as anchors. Free stops flow around them in the
    // geographic (NN) order, timed by their realistic durations so "before" and
    // "after" the anchor sequence sensibly.
    const reservations = input.reservations ?? [];
    if (reservations.length > 0) {
      const pinned = new Map(reservations.map((r) => [r.placeId, this.toMinutes(r.time)]));
      let clock = input.startHour * 60;
      const withAnchor = tour.map((p) => {
        if (pinned.has(p.placeId)) {
          return { p, anchor: pinned.get(p.placeId) as number };
        }
        const anchor = clock;
        clock += p.avgVisitMinutes + 15; // visit + a short travel buffer
        return { p, anchor };
      });
      // Stable sort keeps the NN order among free stops while anchors slot by time.
      withAnchor.sort((a, b) => a.anchor - b.anchor);
      return withAnchor.map((x) => x.p);
    }

    // End anchoring takes priority over the evening rule: if an end origin is
    // set, force the stop nearest it to be last. Otherwise, on an evening start
    // push sunset spots to the tail so golden hour lands right.
    if (input.endOrigin && tour.length > 1) {
      const end = input.endOrigin;
      const endStop = tour.reduce((closest, p) =>
        haversineMeters(p, end) < haversineMeters(closest, end) ? p : closest,
      );
      const rest = tour.filter((p) => p.placeId !== endStop.placeId);
      return [...rest, endStop];
    }

    const isEvening = input.startHour >= 16;
    if (isEvening) {
      const sunset = tour.filter((p) => p.isSunsetSpot);
      const rest = tour.filter((p) => !p.isSunsetSpot);
      return [...rest, ...sunset];
    }
    return tour;
  }

  /**
   * Rebuild an itinerary from an EXPLICIT stop order (drag-and-drop manual
   * edit). Skips scoring/selection/reordering — just re-runs assembly so times,
   * transport legs, distance and the budget are recomputed for the given order.
   */
  async rebuild(orderedPlaceIds: string[], input: RouteGenerationInput): Promise<Itinerary> {
    const found = await this.places.findByIds(orderedPlaceIds);
    const byId = new Map(found.map((p) => [p.placeId, p]));
    const ordered = orderedPlaceIds
      .map((id) => byId.get(id))
      .filter((p): p is Place => p !== undefined);
    const hub = input.hub ?? ordered[0]?.hub ?? 'kadikoy-moda';
    return this.assemble(ordered, input, hub);
  }

  // ── assembly (times, lunch, transport, costs) ────────────────────

  private assemble(
    ordered: Place[],
    input: RouteGenerationInput,
    hub: Hub,
  ): Itinerary {
    const reservations = new Map(
      (input.reservations ?? []).map((r) => [r.placeId, r]),
    );
    const stops: ItineraryStop[] = [];
    let clock = input.startHour * 60; // minutes since midnight
    let lunchInserted = false;
    let order = 1;

    let tickets = 0;
    let food = 0;
    let transport = 0;
    let distanceMeters = 0;

    for (let i = 0; i < ordered.length; i++) {
      const place = ordered[i];

      // Auto Lunch Break when the day crosses midday and we haven't eaten.
      if (
        !lunchInserted &&
        clock >= HubBudgetStrategy.LUNCH_START &&
        clock <= HubBudgetStrategy.LUNCH_END + 60
      ) {
        const lunchCost = this.lunchCost(input.group);
        food += lunchCost;
        stops.push({
          order: order++,
          place: null,
          isLunchBreak: true,
          arrivalTime: this.fmt(clock),
          departureTime: this.fmt(clock + HubBudgetStrategy.LUNCH_DURATION),
          durationMinutes: HubBudgetStrategy.LUNCH_DURATION,
          entryFeeTry: 0,
          foodCostTry: lunchCost,
          transportToNext: null,
        });
        clock += HubBudgetStrategy.LUNCH_DURATION;
        lunchInserted = true;
      }

      // Pinned reservation → the stop's arrival time is FIXED. If we'd arrive
      // earlier, we wait; the whole day re-times around this anchor.
      const res = reservations.get(place.placeId);
      if (res) {
        const pinned = this.toMinutes(res.time);
        if (pinned >= clock) clock = pinned; // wait for the booking
        else clock = pinned; // honor the pin even if it means an earlier slot
      }

      const arrival = clock;
      const departure = clock + place.avgVisitMinutes;
      tickets += place.entryFeeTry;
      food += place.avgFoodCostTry;

      // Transport to the next real stop.
      let leg: TransportLeg | null = null;
      const next = ordered[i + 1];
      if (next) {
        leg = this.transportLeg(place, next);
        distanceMeters += leg.distanceMeters;
        transport += this.transportCost(leg, input.group);
      }

      stops.push({
        order: order++,
        place,
        isLunchBreak: false,
        arrivalTime: this.fmt(arrival),
        departureTime: this.fmt(departure),
        durationMinutes: place.avgVisitMinutes,
        entryFeeTry: place.entryFeeTry,
        foodCostTry: place.avgFoodCostTry,
        transportToNext: leg,
        reservation: res
          ? { time: res.time, confirmationCode: res.confirmationCode, note: res.note }
          : undefined,
      });

      clock = departure + (leg?.durationMinutes ?? 0);
    }

    const total = tickets + food + transport;
    return {
      hub,
      mode: input.quiz ? 'quiz-vibe' : 'hub-budget',
      group: input.group,
      weather: input.weather,
      stops,
      costBreakdown: {
        ticketsTry: Math.round(tickets),
        foodTry: Math.round(food),
        transportTry: Math.round(transport),
        totalTry: Math.round(total),
      },
      budgetTry: input.budgetTry,
      overBudget: total > input.budgetTry,
      totalDistanceKm: Math.round((distanceMeters / 1000) * 10) / 10,
      totalDurationMinutes: clock - input.startHour * 60,
      generatedAt: new Date().toISOString(),
    };
  }

  // ── transport model ──────────────────────────────────────────────

  private transportLeg(from: LatLng, to: Place): TransportLeg {
    const meters = Math.round(haversineMeters(from, to));

    // Cross-Bosphorus / long hops become a ferry or Marmaray, otherwise walk.
    if (meters > 3000) {
      return {
        mode: 'ferry',
        label: `🚢 Ferry to ${to.name} (~20 min)`,
        distanceMeters: meters,
        durationMinutes: 20,
      };
    }
    if (meters > 1500) {
      return {
        mode: 'tram',
        label: `🚋 Tram / short ride to ${to.name} (~10 min)`,
        distanceMeters: meters,
        durationMinutes: 10,
      };
    }
    const walkMin = Math.max(
      2,
      Math.round(meters / HubBudgetStrategy.WALK_SPEED_M_PER_MIN),
    );
    return {
      mode: 'walk',
      label: `🚶 ${walkMin} min walk (${meters}m)`,
      distanceMeters: meters,
      durationMinutes: walkMin,
    };
  }

  private transportCost(leg: TransportLeg, group: GroupType): number {
    const heads = group === 'solo' ? 1 : group === 'couple' ? 2 : 4;
    const perHead =
      leg.mode === 'ferry' ? 27 : leg.mode === 'tram' ? 27 : 0; // Istanbulkart fare
    return perHead * heads;
  }

  private lunchCost(group: GroupType): number {
    const perHead = 250;
    const heads = group === 'solo' ? 1 : group === 'couple' ? 2 : 4;
    return perHead * heads;
  }

  // ── helpers ──────────────────────────────────────────────────────

  private dedupe(places: Place[]): Place[] {
    const seen = new Set<string>();
    return places.filter((p) =>
      seen.has(p.placeId) ? false : (seen.add(p.placeId), true),
    );
  }

  private fmt(totalMinutes: number): string {
    const m = ((totalMinutes % (24 * 60)) + 24 * 60) % (24 * 60);
    const h = Math.floor(m / 60);
    const min = Math.round(m % 60);
    return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
  }

  /** "HH:mm" → minutes since midnight. */
  private toMinutes(hhmm: string): number {
    const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
    if (!m) return 0;
    return Number(m[1]) * 60 + Number(m[2]);
  }
}
