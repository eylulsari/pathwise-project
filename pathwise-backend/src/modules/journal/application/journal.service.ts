import { Inject, Injectable } from '@nestjs/common';
import { Interest } from '../../places/domain/place';
import { PlacesService } from '../../places/application/places.service';
import {
  JOURNAL_REPOSITORY,
  JournalRepositoryPort,
} from '../domain/journal.repository.port';
import { UpsertJournalDto } from './dto/upsert-journal.dto';

export interface JournalSummary {
  entryCount: number;
  photoCount: number;
  noteCount: number;
  avgRating: number;
  /** Average rating per place category — feeds personalized suggestions (A4). */
  categoryRatings: Partial<Record<Interest, number>>;
}

@Injectable()
export class JournalService {
  constructor(
    @Inject(JOURNAL_REPOSITORY)
    private readonly journal: JournalRepositoryPort,
    private readonly places: PlacesService,
  ) {}

  async upsert(userId: string, dto: UpsertJournalDto) {
    const entry = await this.journal.upsert({ userId, ...dto });
    return entry.toJSON();
  }

  async list(userId: string) {
    const entries = await this.journal.findByUser(userId);
    return entries.map((e) => e.toJSON());
  }

  /** Aggregate stats + per-category average ratings (used by A4). */
  async summary(userId: string): Promise<JournalSummary> {
    const entries = await this.journal.findByUser(userId);
    if (entries.length === 0) {
      return { entryCount: 0, photoCount: 0, noteCount: 0, avgRating: 0, categoryRatings: {} };
    }

    const placeMap = new Map(
      (await this.places.findByIds(entries.map((e) => e.placeId))).map((p) => [
        p.placeId,
        p,
      ]),
    );

    const byCategory = new Map<Interest, { sum: number; n: number }>();
    let ratingSum = 0;
    for (const e of entries) {
      ratingSum += e.rating;
      const place = placeMap.get(e.placeId);
      if (place) {
        const acc = byCategory.get(place.category) ?? { sum: 0, n: 0 };
        acc.sum += e.rating;
        acc.n += 1;
        byCategory.set(place.category, acc);
      }
    }

    const categoryRatings: Partial<Record<Interest, number>> = {};
    for (const [cat, { sum, n }] of byCategory) {
      categoryRatings[cat] = Math.round((sum / n) * 10) / 10;
    }

    return {
      entryCount: entries.length,
      photoCount: entries.filter((e) => e.photoUrl).length,
      noteCount: entries.filter((e) => e.note).length,
      avgRating: Math.round((ratingSum / entries.length) * 10) / 10,
      categoryRatings,
    };
  }
}
