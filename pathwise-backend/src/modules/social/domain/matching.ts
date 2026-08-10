import { Hub } from '../../places/domain/place';
import { TravelTag } from './traveler';

/**
 * Buddy compatibility scoring — framework-free and pure, so the whole economy
 * is testable without a database, a clock or a Nest container.
 *
 * ── How the score works ───────────────────────────────────────────────
 * A weighted sum of three independent components, each normalised to 0–1:
 *
 *   1. STYLE   (50) — how much the two travelers' style tags overlap
 *                     (#Foodie, #Backpacker, …). The strongest signal: it is
 *                     the only one the user states about themselves directly.
 *   2. HUB     (30) — overlap of preferred neighbourhoods. Derived from the
 *                     viewer's saved trips, so it reflects where they actually
 *                     went rather than what they claim.
 *   3. BUDGET  (20) — how close the two spending levels are. Weakest of the
 *                     three: travelling together survives a budget gap far
 *                     more easily than a taste gap.
 *
 * These weights are the whole tuning surface — change the numbers below and
 * nothing else moves. They are deliberately NOT a learned model: a buddy
 * suggestion has to be explainable to the person seeing it ("you both like
 * food and both spent time in Kadıköy"), and 100 travelers is nowhere near
 * enough data to train anything honest.
 *
 * ── Missing data is *skipped*, never scored as zero ───────────────────
 * A brand-new user has no saved trips and therefore no hubs and no budget
 * level. Scoring those as 0 would drag everyone down to roughly the same low
 * number and make the ranking meaningless — worse, it would look like a real
 * verdict. Instead, unavailable components are dropped and the remaining
 * weights are renormalised. When NOTHING is known, the score is `null` and the
 * UI shows no percentage at all rather than inventing one.
 */

/** Coarse spending band. Ordered — adjacency is what the score measures. */
export type BudgetLevel = 'budget' | 'mid' | 'comfort';

const BUDGET_ORDER: BudgetLevel[] = ['budget', 'mid', 'comfort'];

/**
 * Daily-spend thresholds (₺) used to bucket a traveler from their saved trips.
 * Tunable: these are read off the route generator's own budget slider, which
 * runs 0–5000 ₺/day, so the bands split it into rough thirds by real usage
 * rather than by arithmetic.
 */
export const BUDGET_THRESHOLDS = { budgetMax: 750, midMax: 2000 } as const;

/** Bucket an average daily spend into a band. */
export function budgetLevelFromSpend(averageTry: number): BudgetLevel {
  if (averageTry <= BUDGET_THRESHOLDS.budgetMax) return 'budget';
  if (averageTry <= BUDGET_THRESHOLDS.midMax) return 'mid';
  return 'comfort';
}

/** Everything the score needs about one side of a pairing. */
export interface MatchProfile {
  styles: TravelTag[];
  preferredHubs: Hub[];
  /** `null` when unknown (e.g. the user has not saved a trip yet). */
  budgetLevel: BudgetLevel | null;
}

/** The tuning surface. Weights are relative — they need not sum to 100. */
export const MATCH_WEIGHTS = { style: 50, hub: 30, budget: 20 } as const;

/** A component's contribution, kept for the "why" breakdown. */
export interface MatchComponent {
  weight: number;
  /** 0–1, or `null` when the component could not be evaluated. */
  value: number | null;
}

export interface MatchResult {
  /** 0–100, or `null` when no component could be evaluated at all. */
  score: number | null;
  components: { style: MatchComponent; hub: MatchComponent; budget: MatchComponent };
  /** The style tags both sides share — what the UI can name out loud. */
  sharedStyles: TravelTag[];
  sharedHubs: Hub[];
}

/**
 * Overlap coefficient: shared / size of the smaller set.
 *
 * Chosen over Jaccard deliberately. A traveler who lists two tags and shares
 * both of them with someone listing five is a strong match, but Jaccard would
 * score that 2/5 = 0.4 purely because the other person is more talkative.
 * `null` when either side listed nothing — that is missing data, not a zero.
 */
function overlap<T>(a: T[], b: T[]): { value: number | null; shared: T[] } {
  if (a.length === 0 || b.length === 0) return { value: null, shared: [] };
  const bSet = new Set(b);
  const shared = a.filter((x) => bSet.has(x));
  return { value: shared.length / Math.min(a.length, b.length), shared };
}

/**
 * Budget proximity: 1 when both sit in the same band, 0.5 when adjacent, 0 at
 * opposite ends. `null` when either side is unknown.
 */
function budgetProximity(a: BudgetLevel | null, b: BudgetLevel | null): number | null {
  if (!a || !b) return null;
  const distance = Math.abs(BUDGET_ORDER.indexOf(a) - BUDGET_ORDER.indexOf(b));
  return 1 - distance / (BUDGET_ORDER.length - 1);
}

/** Score one pairing. Symmetric: `score(a, b) === score(b, a)`. */
export function scoreMatch(viewer: MatchProfile, other: MatchProfile): MatchResult {
  const style = overlap(viewer.styles, other.styles);
  const hub = overlap(viewer.preferredHubs, other.preferredHubs);
  const budget = budgetProximity(viewer.budgetLevel, other.budgetLevel);

  const components = {
    style: { weight: MATCH_WEIGHTS.style, value: style.value },
    hub: { weight: MATCH_WEIGHTS.hub, value: hub.value },
    budget: { weight: MATCH_WEIGHTS.budget, value: budget },
  };

  // Renormalise over the components we could actually evaluate, so a user with
  // no trip history is still ranked on the signal that does exist.
  const available = Object.values(components).filter((c) => c.value !== null);
  const totalWeight = available.reduce((sum, c) => sum + c.weight, 0);
  const score =
    totalWeight === 0
      ? null
      : Math.round(
          (100 *
            available.reduce((sum, c) => sum + c.weight * (c.value as number), 0)) /
            totalWeight,
        );

  return { score, components, sharedStyles: style.shared, sharedHubs: hub.shared };
}

/**
 * Rank by score, highest first.
 *
 * Unscored travelers (nothing in common to measure) sink below every scored
 * one but keep their original relative order, so the list never reshuffles
 * arbitrarily for a user we know nothing about.
 */
export function rankByScore<T extends { matchScore: number | null }>(items: T[]): T[] {
  return [...items].sort((a, b) => (b.matchScore ?? -1) - (a.matchScore ?? -1));
}
