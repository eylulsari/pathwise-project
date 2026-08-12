import { Injectable } from '@nestjs/common';
import { Hub, Place } from '../../domain/place';
import { PlaceRepositoryPort } from '../../domain/place.repository.port';
import { PLACE_DATASET } from './place.dataset';

/**
 * In-memory adapter for the place repository port, backed by the curated
 * dataset. A real deployment would swap this for a Google Places / Postgres
 * adapter — callers depend only on the port, so nothing else changes.
 */
@Injectable()
export class InMemoryPlaceRepository implements PlaceRepositoryPort {
  private readonly places = PLACE_DATASET;

  async findAll(): Promise<Place[]> {
    return [...this.places];
  }

  async findByHub(hub: Hub): Promise<Place[]> {
    return this.places.filter((p) => p.hub === hub);
  }

  async findByIds(placeIds: string[]): Promise<Place[]> {
    const set = new Set(placeIds);
    return this.places.filter((p) => set.has(p.placeId));
  }

  /** Human-readable neighbourhood labels so a search for "Kadıköy" matches. */
  private static readonly HUB_LABEL: Record<string, string> = {
    sultanahmet: 'Sultanahmet & Old City',
    'eminonu-sirkeci': 'Eminönü & Sirkeci',
    'beyoglu-taksim': 'Beyoğlu & Taksim',
    'karakoy-galata': 'Karaköy & Galata',
    'besiktas-bogaz': 'Beşiktaş & Bosphorus',
    'ortakoy-bebek': 'Ortaköy & Bebek',
    'balat-fener': 'Balat & Fener',
    'kadikoy-moda': 'Kadıköy & Moda',
    uskudar: 'Üsküdar',
    adalar: 'Princes’ Islands (Adalar)',
  };

  // Simple in-memory substring search. A production build would use Postgres
  // full-text search (to_tsvector) or Elasticsearch — this shares the port so
  // the swap is a local change.
  async search(query: string): Promise<Place[]> {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return this.places
      .filter((p) => {
        const haystack = [
          p.name,
          p.category,
          p.hub,
          InMemoryPlaceRepository.HUB_LABEL[p.hub] ?? '',
        ]
          .join(' ')
          .toLowerCase();
        return haystack.includes(q);
      })
      .slice(0, 8);
  }
}
