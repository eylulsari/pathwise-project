import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SafetyPreferences, SubscriptionTier, User } from '../../domain/user';
import {
  CreateUserData,
  UserRepositoryPort,
} from '../../domain/user.repository.port';
import { UserOrmEntity } from './user.orm-entity';

/**
 * Repository Pattern — the TypeORM adapter implementing `UserRepositoryPort`.
 * Maps between the persistence entity and the framework-free domain model.
 */
@Injectable()
export class TypeOrmUserRepository implements UserRepositoryPort {
  constructor(
    @InjectRepository(UserOrmEntity)
    private readonly repo: Repository<UserOrmEntity>,
  ) {}

  private toDomain(row: UserOrmEntity): User {
    return new User({
      id: row.id,
      name: row.name,
      email: row.email,
      passwordHash: row.passwordHash,
      nationality: row.nationality,
      age: row.age,
      travelStyles: row.travelStyles ?? [],
      bio: row.bio,
      subscriptionTier: row.subscriptionTier ?? 'free',
      trialEndsAt: row.trialEndsAt ?? null,
      identifiesAsWoman: row.identifiesAsWoman ?? null,
      visibleToWomenOnly: row.visibleToWomenOnly ?? false,
      showWomenOnly: row.showWomenOnly ?? false,
      points: row.points ?? 0,
      createdAt: row.createdAt,
    });
  }

  async create(data: CreateUserData): Promise<User> {
    const row = this.repo.create({
      name: data.name,
      email: data.email.toLowerCase(),
      passwordHash: data.passwordHash,
      nationality: data.nationality ?? null,
      age: data.age ?? null,
      travelStyles: data.travelStyles ?? [],
      bio: data.bio ?? null,
    });
    const saved = await this.repo.save(row);
    return this.toDomain(saved);
  }

  async findById(id: string): Promise<User | null> {
    const row = await this.repo.findOne({ where: { id } });
    return row ? this.toDomain(row) : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const row = await this.repo.findOne({ where: { email: email.toLowerCase() } });
    return row ? this.toDomain(row) : null;
  }

  /**
   * Newest accounts first, capped.
   *
   * The order is a real limitation and not a preference: compatibility is
   * computed in the application layer, so a cap here means "rank the newest N",
   * not "the best N matches". At the size this app runs at the cap is never
   * reached; the day it is, the score has to move into SQL rather than the cap
   * being raised.
   */
  async listDiscoverable(options: {
    excludeUserId: string;
    includeWomenOnlyVisible: boolean;
    limit: number;
  }): Promise<User[]> {
    const q = this.repo
      .createQueryBuilder('u')
      .where('u.id != :me', { me: options.excludeUserId });
    if (!options.includeWomenOnlyVisible) {
      // `visibleToWomenOnly` is NOT NULL with a false default, so a plain
      // comparison covers every row.
      q.andWhere('u."visibleToWomenOnly" = false');
    }
    const rows = await q
      .orderBy('u."createdAt"', 'DESC')
      .take(options.limit)
      .getMany();
    return rows.map((r) => this.toDomain(r));
  }

  async setPasswordHash(id: string, passwordHash: string): Promise<void> {
    // A targeted update rather than a round-trip through save(): the reset
    // flow has no business rewriting the rest of the row.
    await this.repo.update({ id }, { passwordHash });
  }

  async save(user: User): Promise<User> {
    const saved = await this.repo.save({
      id: user.id,
      name: user.name,
      email: user.email.toLowerCase(),
      passwordHash: user.passwordHash,
      nationality: user.nationality,
      age: user.age,
      travelStyles: user.travelStyles,
      bio: user.bio,
      subscriptionTier: user.subscriptionTier,
    });
    return this.toDomain(saved as UserOrmEntity);
  }

  async setSubscriptionTier(id: string, tier: SubscriptionTier): Promise<User> {
    await this.repo.update({ id }, { subscriptionTier: tier });
    const row = await this.repo.findOne({ where: { id } });
    return this.toDomain(row as UserOrmEntity);
  }

  async setTrialEndsAt(id: string, trialEndsAt: Date | null): Promise<User> {
    await this.repo.update({ id }, { trialEndsAt });
    const row = await this.repo.findOne({ where: { id } });
    return this.toDomain(row as UserOrmEntity);
  }

  /**
   * Partial update — only the keys the user actually submitted are written, so
   * leaving a preference out never silently resets it (and `identifiesAsWoman`
   * can be set back to `null` = "not stated" without clearing the switches).
   */
  async setSafetyPreferences(
    id: string,
    prefs: Partial<SafetyPreferences>,
  ): Promise<User> {
    const patch: Partial<UserOrmEntity> = {};
    if ('identifiesAsWoman' in prefs) patch.identifiesAsWoman = prefs.identifiesAsWoman ?? null;
    if ('visibleToWomenOnly' in prefs) patch.visibleToWomenOnly = !!prefs.visibleToWomenOnly;
    if ('showWomenOnly' in prefs) patch.showWomenOnly = !!prefs.showWomenOnly;
    if (Object.keys(patch).length > 0) await this.repo.update({ id }, patch);
    const row = await this.repo.findOne({ where: { id } });
    return this.toDomain(row as UserOrmEntity);
  }

  /**
   * `points = points + :delta` in SQL rather than loading the row and saving
   * it back, so concurrent awards (e.g. a referral landing while the user
   * finishes a route) both count instead of one overwriting the other.
   */
  async setTravelStyles(id: string, styles: string[]): Promise<User> {
    await this.repo.update({ id }, { travelStyles: styles });
    const row = await this.repo.findOne({ where: { id } });
    return this.toDomain(row as UserOrmEntity);
  }

  async addPoints(id: string, delta: number): Promise<User> {
    await this.repo.increment({ id }, 'points', delta);
    const row = await this.repo.findOne({ where: { id } });
    return this.toDomain(row as UserOrmEntity);
  }
}
