import { Hub } from '../../places/domain/place';
import { BudgetLevel } from './matching';

/**
 * Domain model — framework-free. Mirrors the frontend `Traveler` shape so the
 * buddy list can be served from the API instead of the frontend mock layer.
 */
export type TravelTag =
  | '#SoloVerified'
  | '#Foodie'
  | '#Backpacker'
  | '#CultureSeeker'
  | '#PhotoNomad'
  | '#SlowTravel';

export interface Traveler {
  id: string;
  name: string;
  age: number;
  nationality: string;
  avatarColor: string;
  tags: TravelTag[];
  bio: string;
  /**
   * Legacy community badge. NOTE: despite the name, nothing is verified here
   * either — it is a curated/self-declared marker that predates this module.
   */
  soloVerified: boolean;
  visitedProvinces: string[];
  badges: string[];

  // ── Compatibility inputs (see domain/matching.ts) ──────────────────
  /**
   * Neighbourhoods this traveler gravitates to. For the seed these are stated
   * directly; for a real user they are derived from their saved trips, which
   * is why the matcher treats both sides as the same `MatchProfile` shape.
   */
  preferredHubs: Hub[];
  /** Coarse spending band. `null` = unknown, which the matcher skips. */
  budgetLevel: BudgetLevel | null;

  // ── Opt-in women-traveler mode ────────────────────────────────────
  /**
   * Self-declared, `undefined` = not stated. Mirrors `User.identifiesAsWoman`.
   *
   * ⚠️ SELF-DECLARATION, NOT VERIFIED: Pathwise runs no identity check of any
   * kind, so this flag says only "this account ticked a box". It must never be
   * presented as a safety guarantee, and every UI surface exposing it carries
   * the "self-declared, not verified" disclaimer.
   * TODO(verification): if a real verification mechanism (e.g. an ID check) is
   * ever introduced, add a separate `womanVerifiedAt` field rather than
   * reinterpreting this one.
   */
  identifiesAsWoman?: boolean;
  /** Discoverable only by travelers who have made the same declaration. */
  visibleToWomenOnly?: boolean;
}

/** What a viewer is allowed to see, derived from their own preferences. */
export interface TravelerViewerContext {
  /**
   * Reciprocity: only a viewer who has themselves declared AND switched the
   * mode on may read the (self-declared) flag off other travelers' cards.
   */
  womenModeActive: boolean;
}
