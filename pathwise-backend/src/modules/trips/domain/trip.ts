import { Hub } from '../../places/domain/place';

/** A saved day plan belonging to a user. The full itinerary is snapshotted so
 *  Past Trips can be re-opened exactly as generated. Framework-free. */
export interface TripProps {
  id: string;
  userId: string;
  title: string;
  hub: Hub;
  totalDistanceKm: number;
  totalCostTry: number;
  stopCount: number;
  itinerary: unknown; // Itinerary snapshot (jsonb)
  createdAt: Date;
}

export class Trip {
  readonly id: string;
  readonly userId: string;
  title: string;
  hub: Hub;
  totalDistanceKm: number;
  totalCostTry: number;
  stopCount: number;
  itinerary: unknown;
  readonly createdAt: Date;

  constructor(p: TripProps) {
    this.id = p.id;
    this.userId = p.userId;
    this.title = p.title;
    this.hub = p.hub;
    this.totalDistanceKm = p.totalDistanceKm;
    this.totalCostTry = p.totalCostTry;
    this.stopCount = p.stopCount;
    this.itinerary = p.itinerary;
    this.createdAt = p.createdAt;
  }

  toJSON() {
    return {
      id: this.id,
      title: this.title,
      hub: this.hub,
      totalDistanceKm: this.totalDistanceKm,
      totalCostTry: this.totalCostTry,
      stopCount: this.stopCount,
      itinerary: this.itinerary,
      createdAt: this.createdAt,
    };
  }
}
