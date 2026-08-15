/** DI token for the repository port (interfaces vanish at runtime). */
export const BUDDY_CONNECTION_REPOSITORY = Symbol('BUDDY_CONNECTION_REPOSITORY');

/**
 * Who a traveller has connected with.
 *
 * Same shape as route likes, and for the same reason: a `UNIQUE(userId,
 * travelerId)` constraint is what makes "connected once" true rather than
 * merely intended, and it lets `connect()` be idempotent without a
 * read-modify-write race. Disconnecting deletes the row.
 *
 * This was the last feature still keeping user-generated state in
 * `localStorage`, which meant a connection lived in one browser: it did not
 * survive a different device, and the SOS "share my location" alert — which
 * targets connected buddies — was reading a list the server had never seen.
 */
export interface BuddyConnectionRepositoryPort {
  /** Idempotent: connecting to someone already connected changes nothing. */
  connect(userId: string, travelerId: string): Promise<void>;
  /** Idempotent: disconnecting from someone not connected changes nothing. */
  disconnect(userId: string, travelerId: string): Promise<void>;
  /** The travelers this particular viewer has connected with. */
  connectedTravelerIds(userId: string): Promise<Set<string>>;
}
