/** DI token for the repository port (interfaces vanish at runtime). */
export const PLAN_REPOSITORY = Symbol('PLAN_REPOSITORY');

/**
 * The plan a traveller is currently working on, as opposed to the finished
 * ones in `trips`.
 *
 * Two different things, deliberately kept apart. A saved trip is an archive
 * entry the user named and chose to keep; the working plan is the dashboard's
 * live state, rewritten on every edit and holding exactly one row per user.
 * Folding the two together would either fill Past Trips with autosaves or
 * make "save this trip" mean "overwrite the one I am editing".
 */
export interface PlanRepositoryPort {
  /** The user's working plan, or null if they have never edited one. */
  find(userId: string): Promise<unknown[] | null>;
  /** Replaces the whole plan. One row per user, upserted. */
  save(userId: string, days: unknown[]): Promise<void>;
  /** Used when a traveller wants to start over. */
  clear(userId: string): Promise<void>;
}
