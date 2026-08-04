import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PointAction, PointTransaction } from '../../domain/points';
import {
  PointTransactionRepositoryPort,
  RecordPointTransactionData,
} from '../../domain/point-transaction.repository.port';
import { PointTransactionOrmEntity } from './point-transaction.orm-entity';

/** Repository Pattern — the TypeORM adapter for the points ledger. */
@Injectable()
export class TypeOrmPointTransactionRepository
  implements PointTransactionRepositoryPort
{
  constructor(
    @InjectRepository(PointTransactionOrmEntity)
    private readonly repo: Repository<PointTransactionOrmEntity>,
  ) {}

  private toDomain(row: PointTransactionOrmEntity): PointTransaction {
    return {
      id: row.id,
      userId: row.userId,
      action: row.action,
      points: row.points,
      reference: row.reference ?? null,
      createdAt: row.createdAt,
    };
  }

  async record(data: RecordPointTransactionData): Promise<PointTransaction> {
    const saved = await this.repo.save(this.repo.create(data));
    return this.toDomain(saved);
  }

  async findLastByAction(
    userId: string,
    action: PointAction,
  ): Promise<PointTransaction | null> {
    const row = await this.repo.findOne({
      where: { userId, action },
      order: { createdAt: 'DESC' },
    });
    return row ? this.toDomain(row) : null;
  }

  async listRecent(userId: string, limit: number): Promise<PointTransaction[]> {
    const rows = await this.repo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: limit,
    });
    return rows.map((r) => this.toDomain(r));
  }
}
