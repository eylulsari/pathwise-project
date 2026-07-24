import { Hub, Place } from './place';

export const PLACE_REPOSITORY = Symbol('PLACE_REPOSITORY');

/**
 * Repository Pattern port for places. Backed by a curated in-memory dataset
 * today; swap for a Google Places / Postgres adapter without touching callers.
 */
export interface PlaceRepositoryPort {
  findAll(): Promise<Place[]>;
  findByHub(hub: Hub): Promise<Place[]>;
  findByIds(placeIds: string[]): Promise<Place[]>;
}
