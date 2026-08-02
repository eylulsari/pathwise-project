import { Injectable } from '@nestjs/common';
import {
  Traveler,
  TravelTag,
  TravelerViewerContext,
} from '../domain/traveler';
import { TRAVELER_SEED } from '../infrastructure/persistence/traveler.dataset';

/** What a caller may actually see — `visibleToWomenOnly` is never exposed. */
export type PublicTraveler = Omit<Traveler, 'visibleToWomenOnly'>;

export interface TravelerListResult {
  travelers: PublicTraveler[];
  /**
   * Whether the `womenOnly` filter was actually applied. It is refused (and
   * reported as `false`) for viewers who have not opted in themselves — see
   * the reciprocity rule below.
   */
  womenOnlyApplied: boolean;
}

export interface ListTravelersOptions {
  womenOnly?: boolean;
  tag?: TravelTag;
}

/**
 * Traveler Buddy Finder.
 *
 * ⚠️ SELF-DECLARATION, NOT VERIFICATION: the women-traveler mode filters on a
 * box the account holder ticked themselves. Pathwise performs no identity
 * check of any kind, so a filtered list is NOT a vetted or verified set of
 * people and must never be presented as one. Every UI surface that exposes
 * this filter is required to carry the "self-declared, not verified"
 * disclaimer.
 * TODO(verification): if a real verification mechanism (e.g. an ID check) is
 * ever added, filter on a separate verified field rather than reinterpreting
 * `identifiesAsWoman`, and update the disclaimer copy at the same time.
 */
@Injectable()
export class SocialService {
  /**
   * Reciprocity — the single rule that governs this feature:
   *
   * 1. **Discovery.** A traveler who set `visibleToWomenOnly` is hidden from
   *    everyone whose own women-mode is not active.
   * 2. **Reading the flag.** `identifiesAsWoman` is stripped from the payload
   *    for those same viewers, so a browsing account can never read anyone's
   *    declaration off the wire.
   * 3. **Filtering.** `womenOnly` is refused for those viewers too — otherwise
   *    list membership would leak exactly the declaration rule 2 hides.
   */
  listTravelers(
    options: ListTravelersOptions,
    viewer: TravelerViewerContext,
  ): TravelerListResult {
    const eligible = viewer.womenModeActive;
    const womenOnlyApplied = !!options.womenOnly && eligible;

    const travelers = TRAVELER_SEED.filter((t) => {
      // (1) honour each traveler's own visibility preference
      if (t.visibleToWomenOnly && !eligible) return false;
      // (3) the women-traveler filter, only for eligible viewers
      if (womenOnlyApplied && t.identifiesAsWoman !== true) return false;
      if (options.tag && !t.tags.includes(options.tag)) return false;
      return true;
    }).map((t) => this.toPublic(t, eligible));

    return { travelers, womenOnlyApplied };
  }

  /** (2) Strip the declaration for viewers who have not made one themselves. */
  private toPublic(traveler: Traveler, eligible: boolean): PublicTraveler {
    const { visibleToWomenOnly: _hidden, ...rest } = traveler;
    if (!eligible) {
      const { identifiesAsWoman: _undisclosed, ...redacted } = rest;
      return redacted;
    }
    return rest;
  }
}
