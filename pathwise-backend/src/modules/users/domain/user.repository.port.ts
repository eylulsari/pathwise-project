import { SafetyPreferences, SubscriptionTier, User } from './user';

/** DI token for the repository port (interfaces vanish at runtime). */
export const USER_REPOSITORY = Symbol('USER_REPOSITORY');

export interface CreateUserData {
  name: string;
  email: string;
  passwordHash: string;
  nationality?: string | null;
  age?: number | null;
  travelStyles?: string[];
  bio?: string | null;
}

/**
 * Repository Pattern — the port. The application layer depends only on this
 * interface; `TypeOrmUserRepository` in infrastructure/ implements it.
 */
export interface UserRepositoryPort {
  create(data: CreateUserData): Promise<User>;
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  /**
   * Accounts that may appear in someone else's buddy list.
   *
   * `includeWomenOnlyVisible` is passed in rather than decided here: the
   * reciprocity rule that computes it lives in `SocialService`, next to the
   * identical rule for the demo seed, so there is exactly one statement of who
   * is eligible to see whom. This method only executes the filter — in SQL, so
   * the cap applies to the rows that survive it rather than to the rows before.
   */
  listDiscoverable(options: {
    excludeUserId: string;
    includeWomenOnlyVisible: boolean;
    limit: number;
  }): Promise<User[]>;
  save(user: User): Promise<User>;
  /** Replace only the password hash — used by the reset flow. */
  setPasswordHash(id: string, passwordHash: string): Promise<void>;
  setSubscriptionTier(id: string, tier: SubscriptionTier): Promise<User>;
  setTrialEndsAt(id: string, trialEndsAt: Date | null): Promise<User>;
  /** Partial update of the opt-in women-traveler preferences. */
  setSafetyPreferences(
    id: string,
    prefs: Partial<SafetyPreferences>,
  ): Promise<User>;
  /**
   * Atomically add to the reward-points balance. A relative increment (not a
   * read-modify-write) so two awards landing at once cannot lose one another.
   */
  addPoints(id: string, delta: number): Promise<User>;
  /** Replace the travel-style tags (buddy-matching vocabulary). */
  setTravelStyles(id: string, styles: string[]): Promise<User>;
}
