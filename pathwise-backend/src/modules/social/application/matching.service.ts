import { Injectable } from '@nestjs/common';
import { Hub } from '../../places/domain/place';
import { Trip } from '../../trips/domain/trip';
import { TripsService } from '../../trips/application/trips.service';
import { UsersService } from '../../users/application/users.service';
import {
  budgetLevelFromSpend,
  MatchProfile,
  rankByScore,
  scoreMatch,
} from '../domain/matching';
import { TravelTag, Traveler } from '../domain/traveler';

/** How many hubs count as "preferred" — the top few, not the whole history. */
const TOP_HUBS = 3;

/**
 * Travel styles + saved trips → a match profile. Pure, so the single-user and
 * the whole-list paths cannot derive a profile two different ways.
 */
function profileFrom(travelStyles: string[], trips: Trip[]): MatchProfile {
  // Most-visited hubs first, capped — a single trip to a hub should not weigh
  // the same as five.
  const counts = new Map<Hub, number>();
  for (const trip of trips) {
    counts.set(trip.hub, (counts.get(trip.hub) ?? 0) + 1);
  }
  const preferredHubs = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, TOP_HUBS)
    .map(([hub]) => hub);

  // Average spend per saved trip → a coarse band.
  const budgetLevel =
    trips.length === 0
      ? null
      : budgetLevelFromSpend(
          trips.reduce((sum, t) => sum + t.totalCostTry, 0) / trips.length,
        );

  return { styles: travelStyles as TravelTag[], preferredHubs, budgetLevel };
}

/** The only three things the scorer reads off a candidate. */
export type Matchable = Pick<Traveler, 'tags' | 'preferredHubs' | 'budgetLevel'>;

/** A traveler plus how well they match the caller. */
export type ScoredTraveler<T> = T & {
  /** 0–100, or `null` when there was nothing to compare. */
  matchScore: number | null;
  /** The tags both sides share, so the UI can explain the number. */
  sharedStyles: TravelTag[];
};

/**
 * Buddy matching (Görev 2).
 *
 * Sits alongside `SocialService`, which still owns filtering — this service
 * only adds an ordering and a percentage on top. The tag filter and the
 * women-traveler filter are untouched and continue to run first; matching
 * never adds or removes anyone from the list, it only sorts what is left.
 *
 * The arithmetic itself lives in `domain/matching.ts` (pure, no framework).
 * This class exists only to *assemble* the caller's profile out of data that
 * lives in three different modules.
 */
@Injectable()
export class MatchingService {
  constructor(
    private readonly users: UsersService,
    private readonly trips: TripsService,
  ) {}

  /**
   * Build the caller's match profile.
   *
   * - `styles` come from the user record: written by the Vibe Quiz and
   *   editable by hand in the profile.
   * - `preferredHubs` and `budgetLevel` are DERIVED from saved trips rather
   *   than asked for. Nobody would fill in a "which neighbourhoods do you
   *   like" form, and where someone actually went is a better signal than
   *   where they say they want to go. A user with no saved trips simply has
   *   neither, and the matcher skips those components instead of guessing.
   */
  async buildViewerProfile(userId: string): Promise<MatchProfile> {
    const user = await this.users.findById(userId);
    const trips = await this.trips.list(userId);
    return profileFrom(user.travelStyles, trips);
  }

  /**
   * The same profile, for a whole list of candidates.
   *
   * Real accounts are now match candidates rather than only viewers, and every
   * candidate needs the same derivation. One trips query covers all of them —
   * calling `buildViewerProfile` in a loop would be two queries per person.
   *
   * Accounts with no saved trips still get an entry: an empty profile is a real
   * answer ("nothing to compare on"), and leaving them out of the map would be
   * indistinguishable from leaving them out of the list.
   */
  async buildProfilesFor(
    users: { id: string; travelStyles: string[] }[],
  ): Promise<Map<string, MatchProfile>> {
    const trips = await this.trips.listForUsers(users.map((u) => u.id));
    const byUser = new Map<string, Trip[]>();
    for (const trip of trips) {
      const list = byUser.get(trip.userId);
      if (list) list.push(trip);
      else byUser.set(trip.userId, [trip]);
    }
    return new Map(
      users.map((u) => [u.id, profileFrom(u.travelStyles, byUser.get(u.id) ?? [])]),
    );
  }

  /**
   * Attach a compatibility score to each traveler and sort by it, best first.
   * Pure given its inputs — the profile assembly above is the only I/O.
   *
   * The constraint names the three fields the scorer reads, rather than a whole
   * traveler type. Real accounts and demo profiles are different shapes and
   * neither is a subset of the other; what they share is exactly what is
   * compared.
   */
  rank<T extends Matchable>(
    travelers: T[],
    viewer: MatchProfile,
  ): ScoredTraveler<T>[] {
    const scored = travelers.map((traveler) => {
      const result = scoreMatch(viewer, {
        styles: traveler.tags,
        preferredHubs: traveler.preferredHubs,
        budgetLevel: traveler.budgetLevel,
      });
      return {
        ...traveler,
        matchScore: result.score,
        sharedStyles: result.sharedStyles,
      };
    });
    return rankByScore(scored);
  }
}
