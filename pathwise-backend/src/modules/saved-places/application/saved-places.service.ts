import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Place } from '../../places/domain/place';
import { PlacesService } from '../../places/application/places.service';
import {
  SAVED_PLACE_REPOSITORY,
  SavedPlaceRepositoryPort,
} from '../domain/saved-place.repository.port';

@Injectable()
export class SavedPlacesService {
  constructor(
    @Inject(SAVED_PLACE_REPOSITORY)
    private readonly repo: SavedPlaceRepositoryPort,
    private readonly places: PlacesService,
  ) {}

  /**
   * Saving an id that is not in the catalogue is a 404, not a silent success.
   *
   * The row would insert perfectly happily — there is no foreign key — and the
   * place would then be invisible on every read, because reads hydrate through
   * the catalogue. A save button that appears to work and produces nothing is
   * worse than an error.
   */
  async save(userId: string, placeId: string): Promise<void> {
    const [place] = await this.places.findByIds([placeId]);
    if (!place) throw new NotFoundException('Place not found');
    await this.repo.save(userId, placeId);
  }

  /** Not existence-checked: a place removed from the catalogue must still be
   *  removable from a list, or the row would be impossible to clear. */
  async unsave(userId: string, placeId: string): Promise<void> {
    await this.repo.unsave(userId, placeId);
  }

  /**
   * The saved places as full records, newest first.
   *
   * `findByIds` does not promise order, so the saved order is re-applied here.
   * Ids that no longer exist in the catalogue are dropped rather than returned
   * as holes for the UI to guard against.
   */
  async list(userId: string): Promise<Place[]> {
    const ids = await this.repo.savedPlaceIds(userId);
    if (ids.length === 0) return [];
    const byId = new Map((await this.places.findByIds(ids)).map((p) => [p.placeId, p]));
    return ids.map((id) => byId.get(id)).filter((p): p is Place => p !== undefined);
  }

  /** Just the ids — what the UI needs to draw the toggle on a place card. */
  savedIds(userId: string): Promise<string[]> {
    return this.repo.savedPlaceIds(userId);
  }
}
