/** DI token for the repository port (interfaces vanish at runtime). */
export const ROUTE_LIKE_REPOSITORY = Symbol('ROUTE_LIKE_REPOSITORY');

/**
 * Likes are rows, not a counter.
 *
 * A `UNIQUE(userId, routeId)` constraint is what makes "one like per person"
 * true rather than merely intended, and it is why `like()` is idempotent:
 * liking twice leaves exactly one row. The number shown to users is derived
 * with `COUNT(*)` on every read, so there is no tally anywhere that could
 * drift away from the rows justifying it.
 */
export interface RouteLikeRepositoryPort {
  /** Idempotent: liking an already-liked route changes nothing. */
  like(userId: string, routeId: string): Promise<void>;
  /** Idempotent: unliking something not liked changes nothing. */
  unlike(userId: string, routeId: string): Promise<void>;
  /** routeId → how many people have liked it. */
  countsByRoute(): Promise<Map<string, number>>;
  /** The routes this particular viewer has liked. */
  likedRouteIds(userId: string): Promise<Set<string>>;
}
