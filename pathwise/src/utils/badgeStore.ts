import type { Badge } from '../types';

/**
 * Locally earned Passport badges.
 *
 * Badges are otherwise static mock data (`BADGES`), so finishing a route used
 * to claim "Badge unlocked!" in the celebration card while the Profile passport
 * never changed. This is the smallest honest fix: record what the user actually
 * completed on this device and merge it over the mock list, so the claim and
 * the passport agree.
 *
 * Deliberately localStorage-only — there is no badges backend yet. When one
 * lands, `earnedBadgeIds()` is the single read point to swap out.
 */
const KEY = 'pathwise.badges.earned';

/** Ids the user has actually unlocked on this device. */
export function earnedBadgeIds(): Set<string> {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return new Set(Array.isArray(raw) ? raw.filter((x): x is string => typeof x === 'string') : []);
  } catch {
    return new Set();
  }
}

/**
 * Mark a badge earned. Returns true only the first time it is recorded, so the
 * caller can tell a genuine unlock from re-completing the same hub.
 */
export function earnBadge(id: string): boolean {
  const ids = earnedBadgeIds();
  if (ids.has(id)) return false;
  ids.add(id);
  try {
    localStorage.setItem(KEY, JSON.stringify([...ids]));
  } catch {
    return false; // storage full/blocked — treat as not recorded
  }
  return true;
}

/** Overlay locally earned badges onto the catalogue (100% progress, earned). */
export function withEarnedBadges(catalogue: Badge[]): Badge[] {
  const ids = earnedBadgeIds();
  return catalogue.map((b) =>
    ids.has(b.id) && !b.earned ? { ...b, earned: true, progress: 100 } : b,
  );
}
