import { Injectable } from '@nestjs/common';
import { Hub } from '../../places/domain/place';
import { avatarColorFor } from '../domain/check-in';
import { BudgetLevel } from '../domain/matching';
import {
  Traveler,
  TravelTag,
  TravelerViewerContext,
} from '../domain/traveler';
import { UsersService } from '../../users/application/users.service';
import { MessagingService } from '../../messaging/application/messaging.service';
import { TRAVELER_SEED } from '../infrastructure/persistence/traveler.dataset';

/** What a caller may actually see — `visibleToWomenOnly` is never exposed. */
export type PublicTraveler = Omit<Traveler, 'visibleToWomenOnly'>;

/**
 * A real account as it appears in the buddy list.
 *
 * Deliberately NOT the `Traveler` shape. A seed profile is a hand-written
 * fixture with an age, a nationality and a bio guaranteed to be there; a real
 * account has whatever its owner chose to fill in, and most of it is nullable.
 * Forcing accounts through the seed's type would mean inventing defaults —
 * an age of 0, an empty-string nationality — that the UI would then render.
 *
 * `isSample: false` is stated rather than implied. Both lists carry the flag,
 * so a client can never tell them apart by which array they arrived in and
 * then get it wrong the day the two are merged.
 */
export interface RealTraveler {
  id: string;
  name: string;
  age: number | null;
  nationality: string | null;
  avatarColor: string;
  tags: TravelTag[];
  bio: string | null;
  preferredHubs: Hub[];
  budgetLevel: BudgetLevel | null;
  identifiesAsWoman?: boolean;
  isSample: false;
}

/** A seed profile. Shown for texture; never an action target. */
export type SampleTraveler = PublicTraveler & { isSample: true };

export interface TravelerListResult {
  /** Real accounts. The only ones that can be connected to. */
  travelers: RealTraveler[];
  /** The curated demo profiles. Display only. */
  sampleTravelers: SampleTraveler[];
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
 * How many accounts the buddy list will consider. See
 * `UserRepositoryPort.listDiscoverable` for why raising this is not the fix
 * when it is ever reached.
 */
const DISCOVERABLE_LIMIT = 200;

/**
 * Traveler Buddy Finder.
 *
 * ── Two sources, and only one of them is a person ────────────────────
 * The list used to be the demo seed and nothing else, which meant buddy
 * matching scored a real user's real trip history against invented people and
 * offered a "connect" button that wrote a row nobody would ever read. Those
 * are now separated at the source: `travelers` are accounts, `sampleTravelers`
 * are fixtures, and every action in the app hangs off the first list.
 *
 * The seed stays because a buddy finder with two accounts in it demonstrates
 * nothing — but it is labelled, unranked and inert.
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
  constructor(
    private readonly users: UsersService,
    private readonly messaging: MessagingService,
  ) {}

  /**
   * Reciprocity — the single rule that governs this feature, applied to both
   * sources identically:
   *
   * 1. **Discovery.** Anyone who set `visibleToWomenOnly` is hidden from every
   *    viewer whose own women-mode is not active.
   * 2. **Reading the flag.** `identifiesAsWoman` is stripped from the payload
   *    for those same viewers, so a browsing account can never read anyone's
   *    declaration off the wire.
   * 3. **Filtering.** `womenOnly` is refused for those viewers too — otherwise
   *    list membership would leak exactly the declaration rule 2 hides.
   *
   * It is stated once, here, and both lists are built from it. When the rule
   * lived only over the seed, adding accounts would have been the moment it
   * quietly stopped covering everyone.
   */
  async listTravelers(
    options: ListTravelersOptions,
    viewer: TravelerViewerContext,
    userId: string,
  ): Promise<TravelerListResult> {
    const eligible = viewer.womenModeActive;
    const womenOnlyApplied = !!options.womenOnly && eligible;

    return {
      travelers: await this.listRealTravelers(userId, options, eligible, womenOnlyApplied),
      sampleTravelers: this.listSampleTravelers(options, eligible, womenOnlyApplied),
      womenOnlyApplied,
    };
  }

  /**
   * Real accounts, minus the viewer and minus anyone either of them has
   * blocked.
   *
   * The block exclusion is not cosmetic. Messaging already refuses a blocked
   * pair, so leaving them in the list would only produce a card whose one
   * button is guaranteed to fail — and would tell the blocker that the person
   * they blocked is still around, which is the opposite of what blocking is.
   */
  private async listRealTravelers(
    userId: string,
    options: ListTravelersOptions,
    eligible: boolean,
    womenOnlyApplied: boolean,
  ): Promise<RealTraveler[]> {
    const [accounts, blocked] = await Promise.all([
      this.users.listDiscoverable({
        excludeUserId: userId,
        includeWomenOnlyVisible: eligible, // rule (1)
        limit: DISCOVERABLE_LIMIT,
      }),
      this.messaging.blockedIds(userId),
    ]);

    return accounts
      .filter((u) => !blocked.has(u.id))
      // rule (3) — only ever reached by a viewer who is eligible
      .filter((u) => !womenOnlyApplied || u.identifiesAsWoman === true)
      .filter(
        (u) => !options.tag || (u.travelStyles as TravelTag[]).includes(options.tag),
      )
      .map((u) => ({
        id: u.id,
        name: u.name,
        age: u.age,
        nationality: u.nationality,
        avatarColor: avatarColorFor(u.id),
        tags: u.travelStyles as TravelTag[],
        bio: u.bio,
        // Filled in by the controller from saved trips; an account with no
        // trips keeps the empty values, which the matcher reads as "nothing to
        // compare on" rather than as a preference.
        preferredHubs: [],
        budgetLevel: null,
        // rule (2)
        ...(eligible && u.identifiesAsWoman === true
          ? { identifiesAsWoman: true }
          : {}),
        isSample: false as const,
      }));
  }

  /** The demo seed. Same visibility rules, no connection state, no ranking. */
  private listSampleTravelers(
    options: ListTravelersOptions,
    eligible: boolean,
    womenOnlyApplied: boolean,
  ): SampleTraveler[] {
    return TRAVELER_SEED.filter((t) => {
      if (t.visibleToWomenOnly && !eligible) return false; // (1)
      if (womenOnlyApplied && t.identifiesAsWoman !== true) return false; // (3)
      if (options.tag && !t.tags.includes(options.tag)) return false;
      return true;
    }).map((t) => this.toPublic(t, eligible));
  }

  /** (2) Strip the declaration for viewers who have not made one themselves. */
  private toPublic(traveler: Traveler, eligible: boolean): SampleTraveler {
    const view: Traveler = { ...traveler };
    // Never exposed to anyone — it is the traveler's own visibility setting.
    delete view.visibleToWomenOnly;
    if (!eligible) delete view.identifiesAsWoman;
    return { ...view, isSample: true };
  }
}
