import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PlanRepositoryPort } from '../../domain/plan.repository.port';
import { PlanOrmEntity } from './plan.orm-entity';

/** Repository Pattern — the TypeORM adapter for the working plan. */
@Injectable()
export class TypeOrmPlanRepository implements PlanRepositoryPort {
  constructor(
    @InjectRepository(PlanOrmEntity)
    private readonly repo: Repository<PlanOrmEntity>,
  ) {}

  async find(userId: string): Promise<unknown[] | null> {
    const row = await this.repo.findOne({ where: { userId } });
    if (!row) return null;
    return Array.isArray(row.days) ? row.days : null;
  }

  /**
   * Upsert against the unique userId rather than read-then-write.
   *
   * Edits arrive in bursts — dragging a stop fires a save, and so does the
   * rebuild that follows it. A read-modify-write would let two of those
   * interleave and insert twice, and the constraint would then reject the
   * second with a 500 in the middle of an otherwise fine drag.
   */
  async save(userId: string, days: unknown[]): Promise<void> {
    await this.repo
      .createQueryBuilder()
      .insert()
      .into(PlanOrmEntity)
      .values({ userId, days })
      .orUpdate(['days', 'updatedAt'], ['userId'])
      .execute();
  }

  async clear(userId: string): Promise<void> {
    await this.repo.delete({ userId });
  }
}
