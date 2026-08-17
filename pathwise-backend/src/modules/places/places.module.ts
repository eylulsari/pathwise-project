import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PlacesService } from './application/places.service';
import { EnrichmentService } from './application/enrichment.service';
import { PlacesController } from './infrastructure/http/places.controller';
import { InMemoryPlaceRepository } from './infrastructure/persistence/in-memory-place.repository';
import { OverpassClient } from './infrastructure/enrichment/overpass.client';
import { WikipediaClient } from './infrastructure/enrichment/wikipedia.client';
import { PLACE_REPOSITORY } from './domain/place.repository.port';
import { WikipediaCacheOrmEntity } from './infrastructure/persistence/wikipedia-cache.orm-entity';

@Module({
  imports: [TypeOrmModule.forFeature([WikipediaCacheOrmEntity])],
  controllers: [PlacesController],
  providers: [
    PlacesService,
    { provide: PLACE_REPOSITORY, useClass: InMemoryPlaceRepository },
    // Enrichment sits beside the repository/Strategy path (OSM + Wikipedia).
    EnrichmentService,
    OverpassClient,
    WikipediaClient,
  ],
  // Exported so the itinerary module can pull places for route generation.
  exports: [PlacesService],
})
export class PlacesModule {}
