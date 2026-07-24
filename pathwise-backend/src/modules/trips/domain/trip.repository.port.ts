import { Hub } from '../../places/domain/place';
import { Trip } from './trip';

export const TRIP_REPOSITORY = Symbol('TRIP_REPOSITORY');

export interface CreateTripData {
  userId: string;
  title: string;
  hub: Hub;
  totalDistanceKm: number;
  totalCostTry: number;
  stopCount: number;
  itinerary: unknown;
}

/** Repository Pattern port for saved trips. */
export interface TripRepositoryPort {
  create(data: CreateTripData): Promise<Trip>;
  findByUser(userId: string): Promise<Trip[]>;
  deleteForUser(userId: string, tripId: string): Promise<void>;
}
