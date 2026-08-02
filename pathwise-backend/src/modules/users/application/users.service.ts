import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { SafetyPreferences, SubscriptionTier, User } from '../domain/user';
import {
  CreateUserData,
  USER_REPOSITORY,
  UserRepositoryPort,
} from '../domain/user.repository.port';

/**
 * Application service — orchestrates the domain. Depends on the repository
 * *port*, never on the TypeORM adapter directly (dependency inversion).
 */
@Injectable()
export class UsersService {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly users: UserRepositoryPort,
  ) {}

  create(data: CreateUserData): Promise<User> {
    return this.users.create(data);
  }

  findByEmail(email: string): Promise<User | null> {
    return this.users.findByEmail(email);
  }

  async findById(id: string): Promise<User> {
    const user = await this.users.findById(id);
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  /** Public profile view for `GET /users/me`. */
  async getPublicProfile(id: string) {
    const user = await this.findById(id);
    return user.toPublic();
  }

  /**
   * Set the subscription tier. This is the seam a real payment webhook
   * (Stripe/İyzico) would call after a successful charge.
   * TODO: gate behind a verified payment; for now it's a demo toggle.
   */
  async setSubscriptionTier(id: string, tier: SubscriptionTier) {
    const user = await this.users.setSubscriptionTier(id, tier);
    // Choosing the free tier ends any active trial/reward window.
    if (tier === 'free' && user.trialEndsAt) {
      const cleared = await this.users.setTrialEndsAt(id, null);
      return cleared.toPublic();
    }
    return user.toPublic();
  }

  /** Start an N-day Premium trial for a new user (A6). */
  async startTrial(id: string, days: number) {
    await this.users.setSubscriptionTier(id, 'trial');
    const until = new Date(Date.now() + days * 86400 * 1000);
    return this.users.setTrialEndsAt(id, until);
  }

  /**
   * Extend the premium/trial window by N days (referral reward B2, trial A6).
   * Adds onto the later of "now" or the current trialEndsAt.
   */
  async grantPremiumDays(id: string, days: number) {
    const user = await this.findById(id);
    const base = Math.max(Date.now(), user.trialEndsAt?.getTime() ?? 0);
    const until = new Date(base + days * 86400 * 1000);
    const updated = await this.users.setTrialEndsAt(id, until);
    return updated.toPublic();
  }

  /**
   * Update the opt-in women-traveler preferences. Every key is optional: an
   * omitted preference is left untouched, so a user can flip one switch
   * without being forced to restate (or state at all) the others.
   *
   * ⚠️ Self-declaration only — nothing here is verified. See the note on
   * `SafetyPreferences` before building anything that treats it as a
   * trust/identity signal.
   */
  async updateSafetyPreferences(id: string, prefs: Partial<SafetyPreferences>) {
    const updated = await this.users.setSafetyPreferences(id, prefs);
    return updated.toPublic();
  }

  /** Set an absolute trial end (used by A6 to assign the signup trial). */
  async setTrialEndsAt(id: string, until: Date | null) {
    const updated = await this.users.setTrialEndsAt(id, until);
    return updated.toPublic();
  }
}
