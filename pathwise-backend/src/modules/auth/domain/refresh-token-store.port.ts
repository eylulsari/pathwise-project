/** DI token for the refresh-token store port. */
export const REFRESH_TOKEN_STORE = Symbol('REFRESH_TOKEN_STORE');

/**
 * Port for persisting refresh-token identifiers (JTIs), so tokens can be
 * rotated and revoked. The auth service depends on this port, not on whatever
 * stores them — which is how the move from Redis to Postgres stayed a one-line
 * change in AuthModule.
 */
export interface RefreshTokenStorePort {
  /** Persist a refresh JTI for a user with a TTL (seconds). */
  save(userId: string, jti: string, ttlSeconds: number): Promise<void>;
  /** True if the (userId, jti) pair is still valid. */
  isValid(userId: string, jti: string): Promise<boolean>;
  /** Revoke a single refresh JTI (used on rotation + logout). */
  revoke(userId: string, jti: string): Promise<void>;
}
