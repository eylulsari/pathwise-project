import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Hub } from '../../../places/domain/place';
import { Trip } from '../../domain/trip';
import { CreateTripData, TripRepositoryPort } from '../../domain/trip.repository.port';
import { TripOrmEntity } from './trip.orm-entity';

@Injectable()
export class TypeOrmTripRepository implements TripRepositoryPort {
  constructor(
    @InjectRepository(TripOrmEntity)
    private readonly repo: Repository<TripOrmEntity>,
  ) {}

  private toDomain(row: TripOrmEntity): Trip {
    return new Trip({
      id: row.id,
      userId: row.userId,
      title: row.title,
      hub: row.hub as Hub,
      totalDistanceKm: row.totalDistanceKm,
      totalCostTry: row.totalCostTry,
      stopCount: row.stopCount,
      itinerary: row.itinerary,
      createdAt: row.createdAt,
    });
  }

  async create(data: CreateTripData): Promise<Trip> {
    const saved = await this.repo.save(this.repo.create(data));
    return this.toDomain(saved);
  }

  async findByUser(userId: string): Promise<Trip[]> {
    const rows = await this.repo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
    return rows.map((r) => this.toDomain(r));
  }

  async deleteForUser(userId: string, tripId: string): Promise<void> {
    await this.repo.delete({ id: tripId, userId });
  }
}
