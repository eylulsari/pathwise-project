import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SavedPlaceRepositoryPort } from '../../domain/saved-place.repository.port';
import { SavedPlaceOrmEntity } from './saved-place.orm-entity';

/** Repository Pattern — the TypeORM adapter for saved places. */
@Injectable()
export class TypeOrmSavedPlaceRepository implements SavedPlaceRepositoryPort {
  constructor(
    @InjectRepository(SavedPlaceOrmEntity)
    private readonly repo: Repository<SavedPlaceOrmEntity>,
  ) {}

  /**
   * Idempotent by construction: `ON CONFLICT DO NOTHING` against the
   * (userId, placeId) unique constraint. Two rapid taps cannot both insert.
   */
  async save(userId: string, placeId: string): Promise<void> {
    await this.repo
      .createQueryBuilder()
      .insert()
      .into(SavedPlaceOrmEntity)
      .values({ userId, placeId })
      .orIgnore()
      .execute();
  }

  /** Idempotent: deleting a row that is not there is a no-op. */
  async unsave(userId: string, placeId: string): Promise<void> {
    await this.repo.delete({ userId, placeId });
  }

  /** Newest first — the list reads as "what I just bookmarked", not a set. */
  async savedPlaceIds(userId: string): Promise<string[]> {
    const rows = await this.repo.find({
      where: { userId },
      select: { placeId: true },
      order: { createdAt: 'DESC' },
    });
    return rows.map((r) => r.placeId);
  }
}
