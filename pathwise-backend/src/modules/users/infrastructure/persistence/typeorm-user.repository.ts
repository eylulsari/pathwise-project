import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SubscriptionTier, User } from '../../domain/user';
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
}
