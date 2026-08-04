/**
 * Domain model — framework-free. Knows nothing about TypeORM or NestJS.
 *
 * ── Reward points (Phase 3) ──────────────────────────────────────────
 * Right now this is *accrual only*: users earn points and can see the balance,
 * but there is deliberately no reward catalogue, no spending, and no expiry.
 * The ledger below exists so that when a real catalogue lands (discount codes,
 * partner perks, tier unlocks) the balance it spends is already auditable —
 * every point in `users.points` has a matching row explaining where it came
 * from, so a redemption feature can be built without a data backfill.
 *
 * TODO(rewards): when redemption ships, add a negative-amount action (e.g.
 * 'redeemed') rather than mutating `users.points` directly, so the ledger stays
 * the single source of truth and the balance stays reconstructable from it.
 */

/** Every action that earns points. Adding one here is the only place to edit. */
export type PointAction =
  | 'tour_reserved'
  | 'referral'
  | 'route_completed'
  | 'review';

/**
 * How much each action is worth. Kept as plain data (not scattered through the
 * call sites) so the economy can be retuned in one edit, and so the frontend
 * can render "what earns points" from the same numbers the server awards.
 */
export const POINT_VALUES: Record<PointAction, number> = {
  /** Booked a tour/activity through a partner link. */
  tour_reserved: 25,
  /** Invited a friend who redeemed the code — awarded to BOTH sides. */
  referral: 50,
  /** Finished every stop on a day's route. */
  route_completed: 30,
  /** Left a review on a place (first review only — edits do not re-earn). */
  review: 15,
};

export const POINT_ACTIONS = Object.keys(POINT_VALUES) as PointAction[];

/** One immutable ledger entry. */
export interface PointTransaction {
  id: string;
  userId: string;
  action: PointAction;
  points: number;
  /**
   * What the award was for (tour id, place id, referral code…). Free-form on
   * purpose — it is an audit breadcrumb, not a foreign key, because the things
   * being pointed at live in different modules (and tours are not even
   * persisted yet).
   */
  reference: string | null;
  createdAt: Date;
}

/** Outcome of an award attempt. */
export interface AwardResult {
  action: PointAction;
  /** Points actually added — `0` when the award was declined (e.g. throttled). */
  awarded: number;
  /** The user's balance after the attempt. */
  totalPoints: number;
}

/**
 * Whether two instants fall on the same calendar day, in UTC.
 *
 * Pure and exported so the daily throttle is testable without a database or a
 * clock stub. UTC (not Europe/Istanbul) because that is what Postgres stores
 * and comparing in one fixed zone keeps the rule unambiguous; the practical
 * effect is that the "day" for throttling rolls over at 03:00 Istanbul time.
 */
export function isSameUtcDay(a: Date, b: Date): boolean {
  return (
    a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth() &&
    a.getUTCDate() === b.getUTCDate()
  );
}
