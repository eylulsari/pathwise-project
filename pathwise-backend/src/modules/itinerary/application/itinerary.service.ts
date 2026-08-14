import { Injectable } from '@nestjs/common';
import { Hub, Interest, Place } from '../../places/domain/place';
import { PlacesService } from '../../places/application/places.service';
import { JournalService } from '../../journal/application/journal.service';
import { Itinerary, RouteGenerationInput } from '../domain/itinerary';
import { haversineMeters } from '../domain/geo';
import { RouteStrategyFactory } from './route-strategy.factory';
import { HubBudgetStrategy } from './strategies/hub-budget.strategy';
import { GenerateRouteDto, RebuildRouteDto } from './dto/generate-route.dto';

export interface NearbySuggestion {
  place: Place;
  nearPlaceName: string;
  distanceMeters: number;
  walkMinutes: number;
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
      quiz: dto.quiz,
    };

    const strategy = this.factory.create(dto.mode);
    return strategy.generate(input);
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
