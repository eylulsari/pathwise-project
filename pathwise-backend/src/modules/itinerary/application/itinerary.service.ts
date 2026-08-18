import { Injectable } from '@nestjs/common';
import { Hub, Interest, Place } from '../../places/domain/place';
import { PlacesService } from '../../places/application/places.service';
import { JournalService } from '../../journal/application/journal.service';
import {
  HUB_DATASET,
  HUB_SIDE,
} from '../../places/infrastructure/persistence/hub.dataset';
import { Itinerary, RouteGenerationInput } from '../domain/itinerary';
import {
  MAX_TRIP_DAYS,
  MIN_TRIP_DAYS,
  planHubSequence,
} from '../domain/day-plan';
import { haversineMeters } from '../domain/geo';
import { RouteStrategyFactory } from './route-strategy.factory';
import { HubBudgetStrategy } from './strategies/hub-budget.strategy';
import { optimizeOrder, OptimizeResult } from '../domain/optimize';
import {
  GenerateRouteDto,
  OptimizeRouteDto,
  RebuildRouteDto,
} from './dto/generate-route.dto';

export interface NearbySuggestion {
  place: Place;
  nearPlaceName: string;
  distanceMeters: number;
  walkMinutes: number;
}

/** Both versions of the day, plus what changed between them. */
export interface OptimizeRouteResult {
  /** The day as it was — what "undo" restores. */
  before: Itinerary;
  /** The suggested day. Identical to `before` when nothing could be improved. */
  after: Itinerary;
  summary: OptimizeResult;
}

/**
 * A weekday the optimiser can use, from whatever the client sent.
 *
 * The client knows which day the traveller is planning for and the server does
 * not, so this is an input rather than `new Date()`. An absent or nonsensical
 * value falls back to today in Istanbul — the place the trip is in, never the
 * timezone of the device planning it, which is the same rule the client's
 * open-now badge follows.
 */
function normalizeWeekday(weekday: number | undefined): number {
  if (Number.isInteger(weekday) && weekday! >= 0 && weekday! <= 6) {
    return weekday!;
  }
  const name = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Istanbul',
    weekday: 'short',
  }).format(new Date());
  // Monday-first, matching parseSchedule.
  return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(name);
}

/**
 * Stand-in score for a place with `rating: null` (nobody has rated it yet).
 * Mid-range on purpose — the curated ratings run 4.3–4.8, so an unrated place
 * is neither promoted nor buried. Mirrors the constant in HubBudgetStrategy.
 */
const UNRATED_BASELINE = 4.5;

/**
 * Application service for itinerary generation. Normalizes the request DTO into
 * the domain input, asks the factory for the right strategy, and runs it.
 */
@Injectable()
export class ItineraryService {
  constructor(
    private readonly factory: RouteStrategyFactory,
    // Injected directly for rebuild (order-preserving re-assembly) — this is
    // inherently the hub-budget engine's assembly step, not a new strategy.
    private readonly hubBudget: HubBudgetStrategy,
    private readonly places: PlacesService,
    private readonly journal: JournalService,
  ) {}

  /**
   * Which hub each day of a trip is built around, for a trip of `days` days.
   *
   * Clamped rather than rejected: this only shapes a suggestion the traveller
   * can then change per day, so a nonsense query string should give them a
   * sensible week, not a 400 and an empty dashboard.
   */
  planDays(days: number): Hub[] {
    const wanted = Number.isFinite(days) ? Math.round(days) : MAX_TRIP_DAYS;
    const clamped = Math.min(MAX_TRIP_DAYS, Math.max(MIN_TRIP_DAYS, wanted));
    return planHubSequence(clamped, HUB_DATASET);
  }

  async generate(dto: GenerateRouteDto): Promise<Itinerary> {
    const input: RouteGenerationInput = {
      hub: dto.hub,
      budgetTry: dto.budgetTry,
      paceHours: dto.paceHours,
      group: dto.group,
      interests: (dto.interests ?? []) as Interest[],
      mustVisitIds: dto.mustVisitIds ?? [],
      weather: dto.weather,
      startHour: dto.startHour,
      startOrigin: dto.startOrigin,
      endOrigin: dto.endOrigin,
      reservations: dto.reservations,
      walkingTolerance: dto.walkingTolerance,
      visitedBefore: dto.visitedBefore,
      quiz: dto.quiz,
    };

    const strategy = this.factory.create(dto.mode);
    return strategy.generate(input);
  }

  /**
   * Suggest a shorter order for a day the traveller already has.
   *
   * Returns BOTH itineraries, not just the improved one. The caller has to
   * show what changed and be able to put it back, and rebuilding the original
   * on the client would mean a second implementation of assembly living where
   * it could drift from this one. `summary.improvedMinutes` is transit time
   * only — see the note in optimize.ts on why visit durations are excluded.
   *
   * A day that cannot be improved comes back with the original order and
   * `movedStops: 0`, which is a real answer rather than an error: the button
   * should be able to say "this is already efficient".
   */
  async optimize(dto: OptimizeRouteDto): Promise<OptimizeRouteResult> {
    const input: RouteGenerationInput = {
      hub: dto.hub,
      budgetTry: dto.budgetTry,
      paceHours: dto.paceHours,
      group: dto.group,
      interests: [],
      mustVisitIds: [],
      weather: dto.weather,
      startHour: dto.startHour,
      startOrigin: dto.startOrigin,
      endOrigin: dto.endOrigin,
      reservations: dto.reservations,
    };

    const found = await this.places.findByIds(dto.placeIds);
    const byId = new Map(found.map((p) => [p.placeId, p]));
    // Preserves the caller's order, and drops ids that no longer resolve —
    // the same tolerance rebuild() has, for the same reason: a stale id in a
    // saved plan should cost that stop, not the whole request.
    const ordered = dto.placeIds
      .map((id) => byId.get(id))
      .filter((p): p is Place => p !== undefined);

    const before = await this.hubBudget.rebuild(
      ordered.map((p) => p.placeId),
      input,
    );

    const pinnedIds = new Set((dto.reservations ?? []).map((r) => r.placeId));
    const result = optimizeOrder(
      ordered.map((place) => ({
        place,
        side: HUB_SIDE[place.hub],
        pinned: pinnedIds.has(place.placeId),
      })),
      dto.startHour * 60,
      normalizeWeekday(dto.weekday),
    );

    const after =
      result.movedStops === 0
        ? before
        : await this.hubBudget.rebuild(result.order, input);

    return { before, after, summary: result };
  }

  /** Recompute an itinerary from an explicit, user-defined stop order. */
  async rebuild(dto: RebuildRouteDto): Promise<Itinerary> {
    const input: RouteGenerationInput = {
      hub: dto.hub,
      budgetTry: dto.budgetTry,
      paceHours: dto.paceHours,
      group: dto.group,
      interests: [],
      mustVisitIds: [],
      weather: dto.weather,
      startHour: dto.startHour,
      startOrigin: dto.startOrigin,
      endOrigin: dto.endOrigin,
      reservations: dto.reservations,
    };
    return this.hubBudget.rebuild(dto.placeIds, input);
  }

  /**
   * "Add this too" — suggest one nearby, unselected, high-rated place in the
   * same hub, closest to any current stop. Returns null if nothing fits.
   */
  async suggestNearby(
    hub: Hub,
    selectedIds: string[],
    userId?: string,
  ): Promise<NearbySuggestion | null> {
    const selectedSet = new Set(selectedIds);
    const selected = (await this.places.findByIds(selectedIds)).filter((p) =>
      selectedSet.has(p.placeId),
    );
    if (selected.length === 0) return null;

    const candidates = (await this.places.findByHub(hub)).filter(
      (p) => !selectedSet.has(p.placeId),
    );
    if (candidates.length === 0) return null;

    // A4 — personalize: boost categories the user rated highly in their journal.
    const categoryRatings = userId
      ? (await this.journal.summary(userId)).categoryRatings
      : {};

    // For each candidate, distance to its nearest already-picked stop.
    const scored = candidates.map((c) => {
      let nearest = selected[0];
      let dist = Infinity;
      for (const s of selected) {
        const d = haversineMeters(c, s);
        if (d < dist) {
          dist = d;
          nearest = s;
        }
      }
      // Prefer close + highly rated; a high journal rating for this category
      // pulls the score down (better) so favorite categories surface first.
      const journalBoost = (categoryRatings[c.category] ?? 0) * 120;
      // An unrated place is treated as mid-range, not as zero: `null` means
      // nobody has scored it, and scoring that as 0 would push two thirds of
      // the catalogue to the bottom of every suggestion.
      const score = dist - (c.rating ?? UNRATED_BASELINE) * 60 - journalBoost;
      return { c, nearest, dist, score };
    });

    scored.sort((a, b) => a.score - b.score);
    const best = scored[0];
    return {
      place: best.c,
      nearPlaceName: best.nearest.name,
      distanceMeters: Math.round(best.dist),
      walkMinutes: Math.max(1, Math.round(best.dist / 75)),
    };
  }
}
