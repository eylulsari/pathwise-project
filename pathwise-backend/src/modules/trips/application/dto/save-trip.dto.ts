import { IsObject, IsString, MaxLength, MinLength } from 'class-validator';

/**
 * Save a generated plan. The client sends its own itinerary snapshot; the
 * service derives the summary scalars (hub, distance, cost, stop count) from it
 * so those can't be spoofed independently of the snapshot.
 */
export class SaveTripDto {
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  title: string;

  @IsObject()
  itinerary: Record<string, unknown>;
}
