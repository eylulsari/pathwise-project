/** Free users may run the route optimizer this many times per day. */
export const FREE_OPTIMIZE_LIMIT = 3;

/** Counter key for a user's optimize count on a given day (resets at midnight). */
export function optimizeDailyKey(userId: string, date = new Date()): string {
  const day = date.toISOString().slice(0, 10); // YYYY-MM-DD
  return `optimize:${userId}:${day}`;
}

/** Seconds remaining until the next UTC midnight (counter TTL). */
export function secondsUntilMidnight(now = new Date()): number {
  const next = new Date(now);
  next.setUTCHours(24, 0, 0, 0);
  return Math.max(60, Math.floor((next.getTime() - now.getTime()) / 1000));
}
