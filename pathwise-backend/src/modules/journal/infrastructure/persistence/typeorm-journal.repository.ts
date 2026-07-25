import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JournalEntry } from '../../domain/journal-entry';
import {
  JournalRepositoryPort,
  UpsertJournalData,
} from '../../domain/journal.repository.port';
import { JournalEntryOrmEntity } from './journal-entry.orm-entity';

@Injectable()
export class TypeOrmJournalRepository implements JournalRepositoryPort {
  constructor(
    @InjectRepository(JournalEntryOrmEntity)
    private readonly repo: Repository<JournalEntryOrmEntity>,
  ) {}

  private toDomain(row: JournalEntryOrmEntity): JournalEntry {
    return new JournalEntry({
      id: row.id,
      userId: row.userId,
      placeId: row.placeId,
      photoUrl: row.photoUrl,
      note: row.note,
      rating: row.rating,
      createdAt: row.createdAt,
    });
  }

  async upsert(data: UpsertJournalData): Promise<JournalEntry> {
    const existing = await this.repo.findOne({
      where: { userId: data.userId, placeId: data.placeId },
    });
    if (existing) {
      existing.photoUrl = data.photoUrl ?? existing.photoUrl;
      existing.note = data.note ?? existing.note;
      existing.rating = data.rating;
      return this.toDomain(await this.repo.save(existing));
    }
    const saved = await this.repo.save(this.repo.create(data));
    return this.toDomain(saved);
  }

  async findByUser(userId: string): Promise<JournalEntry[]> {
    const rows = await this.repo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
    return rows.map((r) => this.toDomain(r));
  }
}
