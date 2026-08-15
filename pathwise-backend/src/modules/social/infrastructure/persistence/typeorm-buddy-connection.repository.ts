import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BuddyConnectionRepositoryPort } from '../../domain/buddy-connection.repository.port';
import { BuddyConnectionOrmEntity } from './buddy-connection.orm-entity';

/** Repository Pattern — the TypeORM adapter for buddy connections. */
@Injectable()
export class TypeOrmBuddyConnectionRepository
  implements BuddyConnectionRepositoryPort
{
  constructor(
    @InjectRepository(BuddyConnectionOrmEntity)
    private readonly repo: Repository<BuddyConnectionOrmEntity>,
  ) {}

  /**
   * Idempotent by construction: `ON CONFLICT DO NOTHING` against the
   * (userId, travelerId) unique constraint. Two rapid taps cannot both insert.
   */
  async connect(userId: string, travelerId: string): Promise<void> {
    await this.repo
      .createQueryBuilder()
      .insert()
      .into(BuddyConnectionOrmEntity)
      .values({ userId, travelerId })
      .orIgnore()
      .execute();
  }

  /** Idempotent: deleting a row that is not there is a no-op. */
  async disconnect(userId: string, travelerId: string): Promise<void> {
    await this.repo.delete({ userId, travelerId });
  }

  async connectedTravelerIds(userId: string): Promise<Set<string>> {
    const rows = await this.repo.find({
      where: { userId },
      select: { travelerId: true },
    });
    return new Set(rows.map((r) => r.travelerId));
  }
}
