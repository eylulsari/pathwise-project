import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RouteLikeRepositoryPort } from '../../domain/route-like.repository.port';
import { RouteLikeOrmEntity } from './route-like.orm-entity';

/** Repository Pattern — the TypeORM adapter for route likes. */
@Injectable()
export class TypeOrmRouteLikeRepository implements RouteLikeRepositoryPort {
  constructor(
    @InjectRepository(RouteLikeOrmEntity)
    private readonly repo: Repository<RouteLikeOrmEntity>,
  ) {}

  /**
   * Idempotent by construction: `ON CONFLICT DO NOTHING` against the
   * (userId, routeId) unique constraint. Liking twice leaves one row, and two
   * simultaneous requests cannot both insert — no read-then-write race.
   */
  async like(userId: string, routeId: string): Promise<void> {
    await this.repo
      .createQueryBuilder()
      .insert()
      .into(RouteLikeOrmEntity)
      .values({ userId, routeId })
      .orIgnore()
      .execute();
  }

  /** Idempotent: deleting a row that is not there is a no-op. */
  async unlike(userId: string, routeId: string): Promise<void> {
    await this.repo.delete({ userId, routeId });
  }

  async countsByRoute(): Promise<Map<string, number>> {
    const rows = await this.repo
      .createQueryBuilder('l')
      .select('l.routeId', 'routeId')
      .addSelect('COUNT(*)', 'count')
      .groupBy('l.routeId')
      .getRawMany<{ routeId: string; count: string }>();
    return new Map(rows.map((r) => [r.routeId, Number(r.count)]));
  }

  async likedRouteIds(userId: string): Promise<Set<string>> {
    const rows = await this.repo.find({
      where: { userId },
      select: { routeId: true },
    });
    return new Set(rows.map((r) => r.routeId));
  }
}
