/** DI token for the repository port (interfaces vanish at runtime). */
export const SAVED_PLACE_REPOSITORY = Symbol('SAVED_PLACE_REPOSITORY');

/**
 * The places a traveller has bookmarked.
 *
 * Same shape as route likes and buddy connections, and for the same reason: a
 * `UNIQUE(userId, placeId)` constraint makes "saved once" true rather than
 * merely intended, and lets `save()` be idempotent without a
 * read-modify-write race. Unsaving deletes the row.
 *
 * `placeId` is deliberately not a foreign key — places are a static dataset
 * compiled into the image, not a table, so a constraint would point at
 * nothing. The service validates the id against the catalogue instead.
 */
export interface SavedPlaceRepositoryPort {
  /** Idempotent: saving a place already saved changes nothing. */
  save(userId: string, placeId: string): Promise<void>;
  /** Idempotent: unsaving a place that was not saved changes nothing. */
  unsave(userId: string, placeId: string): Promise<void>;
  /** Place ids this viewer has saved, newest first. */
  savedPlaceIds(userId: string): Promise<string[]>;
}
