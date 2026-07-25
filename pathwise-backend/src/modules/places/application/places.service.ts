import { Inject, Injectable } from '@nestjs/common';
import { Hub, Place } from '../domain/place';
import {
  PLACE_REPOSITORY,
  PlaceRepositoryPort,
} from '../domain/place.repository.port';

@Injectable()
export class PlacesService {
  constructor(
    @Inject(PLACE_REPOSITORY)
    private readonly places: PlaceRepositoryPort,
  ) {}

  findAll(): Promise<Place[]> {
    return this.places.findAll();
  }

  findByHub(hub: Hub): Promise<Place[]> {
    return this.places.findByHub(hub);
  }

  findByIds(ids: string[]): Promise<Place[]> {
    return this.places.findByIds(ids);
  }

  search(query: string): Promise<Place[]> {
    return this.places.search(query);
  }
}
