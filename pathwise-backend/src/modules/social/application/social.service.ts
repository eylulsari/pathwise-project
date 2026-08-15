import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  Traveler,
  TravelTag,
  TravelerViewerContext,
} from '../domain/traveler';
import {
  BUDDY_CONNECTION_REPOSITORY,
  BuddyConnectionRepositoryPort,
} from '../domain/buddy-connection.repository.port';
import { TRAVELER_SEED } from '../infrastructure/persistence/traveler.dataset';

/** What a caller may actually see — `visibleToWomenOnly` is never exposed. */
export type PublicTraveler = Omit<Traveler, 'visibleToWomenOnly'>;

export interface TravelerListResult {
  travelers: PublicTraveler[];
  /**
   * Traveler ids this viewer has connected with. Sent alongside the list so
   * the client renders the correct button state from the server's answer
   * rather than from whatever the browser happened to remember.
   */
  connectedTravelerIds: string[];
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
  constructor(
    @Inject(BUDDY_CONNECTION_REPOSITORY)
    private readonly connections: BuddyConnectionRepositoryPort,
  ) {}

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
  async listTravelers(
    options: ListTravelersOptions,
    viewer: TravelerViewerContext,
    userId?: string,
  ): Promise<TravelerListResult> {
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

    const connected = userId
      ? await this.connections.connectedTravelerIds(userId)
      : new Set<string>();

    return {
      travelers,
      womenOnlyApplied,
      // Only ids from THIS response. A connection to someone the viewer can no
      // longer see (they turned on women-only visibility afterwards) must not
      // leak back as a name in the list — rule (1) would be undone by rule (4).
      connectedTravelerIds: travelers
        .map((t) => t.id)
        .filter((id) => connected.has(id)),
    };
  }

  /**
   * Connect to a traveler. Idempotent, and refuses ids the viewer cannot see.
   *
   * The visibility check is not decoration. Without it, POSTing an id straight
   * at this endpoint would confirm that a hidden traveler exists — which is
   * exactly the declaration the reciprocity rule keeps from browsing accounts.
   * An unknown id and a hidden one both come back 404, so the two are
   * indistinguishable from outside.
   */
  async connect(
    userId: string,
    travelerId: string,
    viewer: TravelerViewerContext,
  ): Promise<void> {
    this.assertVisible(travelerId, viewer);
    await this.connections.connect(userId, travelerId);
  }

  /**
   * Disconnect. Deliberately NOT visibility-checked: someone who becomes
   * hidden after you connected must still be removable, or the connection
   * would be impossible to undo.
   */
  async disconnect(userId: string, travelerId: string): Promise<void> {
    await this.connections.disconnect(userId, travelerId);
  }

  private assertVisible(travelerId: string, viewer: TravelerViewerContext): void {
    const traveler = TRAVELER_SEED.find((t) => t.id === travelerId);
    if (!traveler || (traveler.visibleToWomenOnly && !viewer.womenModeActive)) {
      throw new NotFoundException('Traveler not found');
    }
  }

  /** (2) Strip the declaration for viewers who have not made one themselves. */
  private toPublic(traveler: Traveler, eligible: boolean): PublicTraveler {
    const view: Traveler = { ...traveler };
    // Never exposed to anyone — it is the traveler's own visibility setting.
    delete view.visibleToWomenOnly;
    if (!eligible) delete view.identifiesAsWoman;
    return view;
  }
}
