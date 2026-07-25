import { SubscriptionTier, User } from './user';

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
  save(user: User): Promise<User>;
  setSubscriptionTier(id: string, tier: SubscriptionTier): Promise<User>;
  setTrialEndsAt(id: string, trialEndsAt: Date | null): Promise<User>;
}
