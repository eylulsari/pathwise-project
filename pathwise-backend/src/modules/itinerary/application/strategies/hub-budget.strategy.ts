import { Injectable } from '@nestjs/common';
import { PlacesService } from '../../../places/application/places.service';
import { Hub, Interest, Place } from '../../../places/domain/place';
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

  constructor(private readonly places: PlacesService) {}

  async generate(input: RouteGenerationInput): Promise<Itinerary> {
    const hub = input.hub ?? 'kadikoy-moda';

    // 1 — candidate pool: hub places + must-visits from anywhere.
    const hubPlaces = await this.places.findByHub(hub);
    const mustVisits = input.mustVisitIds.length
      ? await this.places.findByIds(input.mustVisitIds)
      : [];
    const pool = this.dedupe([...mustVisits, ...hubPlaces]);
    const mustSet = new Set(input.mustVisitIds);

    // 2 — score and sort (must-visits always float to the top).
    const scored = pool
      .map((p) => ({ place: p, score: this.score(p, input, mustSet) }))
      .sort((a, b) => b.score - a.score);

    // 3 — greedy selection within the time budget.
    const timeBudget = input.paceHours * 60;
    let usedMinutes = 0;
    const selected: Place[] = [];
    // Force must-visits in first (never dropped).
    for (const { place } of scored) {
      if (mustSet.has(place.placeId)) {
        selected.push(place);
        usedMinutes += place.avgVisitMinutes;
      }
    }
    for (const { place } of scored) {
      if (mustSet.has(place.placeId)) continue;
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

    // Nearest-neighbour tour starting from the northern-most stop so the walk
    // reads naturally. (A real build would call OSRM for an optimized route.)
    const remaining = [...places];
    const start = remaining.reduce((a, b) => (a.lat > b.lat ? a : b));
    const tour: Place[] = [start];
    remaining.splice(remaining.indexOf(start), 1);

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

    // Evening start → push sunset spots to the tail so golden hour lands right.
    const isEvening = input.startHour >= 16;
    if (isEvening) {
      const sunset = tour.filter((p) => p.isSunsetSpot);
      const rest = tour.filter((p) => !p.isSunsetSpot);
      return [...rest, ...sunset];
    }
    return tour;
  }

  // ── assembly (times, lunch, transport, costs) ────────────────────

  private assemble(
    ordered: Place[],
    input: RouteGenerationInput,
    hub: Hub,
  ): Itinerary {
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
}
