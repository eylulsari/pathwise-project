/**
 * "Is this traveler still around?" — the liveness layer over check-ins.
 *
 * Deliberately a pure module with no React, no fetching and no clock of its
 * own: every function takes `now` as an argument (defaulting to the real
 * clock), so the whole rule is decidable from its inputs. When check-ins move
 * from the mock layer to a real `check_ins` table, nothing here changes — only
 * where `createdAt` comes from.
 *
 * ── Why a timestamp comparison and not a socket ──────────────────────
 * Presence here means "posted a check-in recently", which is a fact about a
 * timestamp, not a live connection. A WebSocket would let us show someone
 * going offline the instant they close the tab, but it would also imply a
 * precision this feature does not have: a check-in says where someone WAS,
 * and no transport can turn that into where they ARE. Comparing against a
 * window keeps the promise honest and the infrastructure boring.
 *
 * ⚠️ This is not a location tracker. It never says where a traveler is now,
 * only that they posted from somewhere within the window. The UI wording must
 * stay in that register ("recently here", not "is here").
 */

/**
 * How long a check-in keeps someone marked available.
 *
 * Two hours is a judgement call, not a measurement: long enough to cover a
 * meal or a museum, short enough that a morning check-in is not still claiming
 * availability at dinner. Tune this single constant — every surface derives
 * from it.
 */
export const PRESENCE_WINDOW_MINUTES = 120;

const MS_PER_MINUTE = 60_000;

export type Presence = 'live' | 'stale';

/** Whole minutes since a check-in. Negative clock skew is clamped to 0. */
export function minutesSince(createdAtISO: string, now: number = Date.now()): number {
  const created = new Date(createdAtISO).getTime();
  if (Number.isNaN(created)) return Number.POSITIVE_INFINITY; // unparseable → treat as old
  return Math.max(0, Math.floor((now - created) / MS_PER_MINUTE));
}

/** Within the window → still marked available. */
export function isLive(createdAtISO: string, now: number = Date.now()): boolean {
  return minutesSince(createdAtISO, now) < PRESENCE_WINDOW_MINUTES;
}

export function presenceOf(createdAtISO: string, now: number = Date.now()): Presence {
  return isLive(createdAtISO, now) ? 'live' : 'stale';
}

/**
 * Human-readable age: "now", "34m", "3h".
 *
 * Kept next to the presence rule because the two are read together — a card
 * shows the dot and the age, and they must never disagree about how old
 * something is.
 */
export function formatAge(createdAtISO: string, now: number = Date.now()): string {
  const minutes = minutesSince(createdAtISO, now);
  if (!Number.isFinite(minutes)) return '—';
  if (minutes < 1) return 'now';
  if (minutes < 60) return `${minutes}m`;
  return `${Math.floor(minutes / 60)}h`;
}
