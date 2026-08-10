import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Hub } from '../../../places/domain/place';
import {
  CheckInRepositoryPort,
  CreateCheckInData,
  PersistedCheckIn,
} from '../../domain/check-in.repository.port';
import { CheckInOrmEntity } from './check-in.orm-entity';

/** Repository Pattern — the TypeORM adapter for persisted check-ins. */
@Injectable()
export class TypeOrmCheckInRepository implements CheckInRepositoryPort {
  constructor(
    @InjectRepository(CheckInOrmEntity)
    private readonly repo: Repository<CheckInOrmEntity>,
  ) {}

  private toDomain(row: CheckInOrmEntity): PersistedCheckIn {
    return {
      id: row.id,
      userId: row.userId,
      authorName: row.authorName,
      message: row.message,
      placeId: row.placeId ?? null,
      hub: (row.hub as Hub) ?? null,
      createdAt: row.createdAt,
    };
  }

  async create(data: CreateCheckInData): Promise<PersistedCheckIn> {
    const saved = await this.repo.save(this.repo.create(data));
    return this.toDomain(saved);
  }

  async listRecent(limit: number): Promise<PersistedCheckIn[]> {
    const rows = await this.repo.find({
      order: { createdAt: 'DESC' },
      take: limit,
    });
    return rows.map((r) => this.toDomain(r));
  }
}
