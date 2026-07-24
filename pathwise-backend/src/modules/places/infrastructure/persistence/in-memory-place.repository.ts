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
}
