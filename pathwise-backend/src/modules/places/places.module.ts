import { Module } from '@nestjs/common';
import { PlacesService } from './application/places.service';
import { PlacesController } from './infrastructure/http/places.controller';
import { InMemoryPlaceRepository } from './infrastructure/persistence/in-memory-place.repository';
import { PLACE_REPOSITORY } from './domain/place.repository.port';

@Module({
  controllers: [PlacesController],
  providers: [
    PlacesService,
    { provide: PLACE_REPOSITORY, useClass: InMemoryPlaceRepository },
  ],
  // Exported so the itinerary module can pull places for route generation.
  exports: [PlacesService],
})
export class PlacesModule {}
