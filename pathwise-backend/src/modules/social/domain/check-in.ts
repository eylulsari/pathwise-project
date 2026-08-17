import { Hub } from '../../places/domain/place';

/**
 * Domain model — framework-free.
 *
 * A check-in is "I am at this place right now". The feed is the union of two
 * sources that behave differently on purpose:
 *
 *  - **Curated seed** — demo travelers who have no user accounts. Their
 *    `createdAt` is derived from a relative offset at read time, so the feed
 *    always spans both sides of the presence window and never ages into a wall
 *    of stale entries.
 *  - **Real check-ins** — written by signed-in users and persisted. Their
 *    `createdAt` is a real database timestamp, which is the point: it ages
 *    honestly and drops out of the "available now" window on its own.
 *
 * The presence rule itself lives on the client (`utils/presence.ts`) and only
 * ever reads `createdAt`, so it does not care which source a row came from.
 */
export interface CheckInAuthor {
  id: string;
  name: string;
  avatarColor: string;
  /**
   * `true` for the curated demo authors, who have no account behind them.
   *
   * Stated by the server rather than inferred by the client. The only other
   * way to tell the two apart is the shape of the id — seed authors are `t1`,
   * real ones are UUIDs — and a UUID regex in the UI would be a rule about
   * primary keys pretending to be a rule about people. It also silently breaks
   * the day the seed is replaced by real rows.
   *
   * What depends on it: nothing may be *offered* against a sample author. They
   * cannot be connected to or messaged, because there is nobody there.
   */
  isSample: boolean;
}

export interface CheckIn {
  id: string;
  traveler: CheckInAuthor;
  /** `null` when the author did not pick a place ("right here"). */
  placeId: string | null;
  /** `null` for the same reason — an unplaced check-in has no neighbourhood. */
  hub: Hub | null;
  message: string;
  createdAt: Date;
}

/**
 * Avatar palette, borrowed from the traveler seed so real users sit visually
 * alongside the demo ones.
 */
const AVATAR_COLORS = [
  '#4A7C82',
  '#C56F52',
  '#6E8F74',
  '#B5654A',
  '#3F6E8C',
  '#A8574C',
  '#7C6A9C',
  '#C98A3E',
  '#B85C7A',
  '#8A6B4F',
];

/**
 * A stable avatar colour for a user.
 *
 * Derived rather than stored: it is presentation, not data, and adding a
 * column for it would mean a migration and a default for every existing row.
 * Deterministic, so the same account always renders the same colour — a
 * random pick per request would make the feed flicker between reloads.
 */
export function avatarColorFor(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = (hash * 31 + userId.charCodeAt(i)) >>> 0;
  }
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

/** Newest first — the order the feed is rendered in. */
export function byNewestFirst(a: CheckIn, b: CheckIn): number {
  return b.createdAt.getTime() - a.createdAt.getTime();
}
