import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { Hub } from '../../places/domain/place';
import { Trip } from '../domain/trip';
import { TRIP_REPOSITORY, TripRepositoryPort } from '../domain/trip.repository.port';
import { SaveTripDto } from './dto/save-trip.dto';

/** Minimal shape read out of a saved itinerary snapshot. */
interface ItinerarySnapshot {
  hub?: string;
  totalDistanceKm?: number;
  costBreakdown?: { totalTry?: number };
  stops?: unknown[];
}

@Injectable()
export class TripsService {
  constructor(
    @Inject(TRIP_REPOSITORY)
    private readonly trips: TripRepositoryPort,
  ) {}

  async save(userId: string, dto: SaveTripDto): Promise<Trip> {
    const snap = dto.itinerary as ItinerarySnapshot;
    if (!snap.hub || !Array.isArray(snap.stops)) {
      throw new BadRequestException('Invalid itinerary snapshot');
    }
    return this.trips.create({
      userId,
      title: dto.title,
      hub: snap.hub as Hub,
      totalDistanceKm: snap.totalDistanceKm ?? 0,
      totalCostTry: snap.costBreakdown?.totalTry ?? 0,
      stopCount: snap.stops.length,
      itinerary: dto.itinerary,
    });
  }

  async list(userId: string): Promise<Trip[]> {
    return this.trips.findByUser(userId);
  }

  /** Trips for several users at once — buddy matching scores a whole list. */
  async listForUsers(userIds: string[]): Promise<Trip[]> {
    return this.trips.findByUsers(userIds);
  }

  async remove(userId: string, tripId: string): Promise<void> {
    await this.trips.deleteForUser(userId, tripId);
  }
}
