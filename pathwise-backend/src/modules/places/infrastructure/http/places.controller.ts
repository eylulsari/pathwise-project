import { Controller, Get, Param, Query } from '@nestjs/common';
import { PlacesService } from '../../application/places.service';
import { EnrichmentService } from '../../application/enrichment.service';
import { Hub } from '../../domain/place';

@Controller('places')
export class PlacesController {
  constructor(
    private readonly places: PlacesService,
    private readonly enrichment: EnrichmentService,
  ) {}

  /** GET /api/places  — optionally ?hub=<hub> */
  @Get()
  list(@Query('hub') hub?: Hub) {
    return hub ? this.places.findByHub(hub) : this.places.findAll();
  }

  /** GET /api/places/search?q= — free-text place search. */
  @Get('search')
  search(@Query('q') q = '') {
    return this.places.search(q);
  }

  /** GET /api/places/:placeId/enrichment — live OSM + Wikipedia detail. */
  @Get(':placeId/enrichment')
  enrich(@Param('placeId') placeId: string) {
    return this.enrichment.getEnrichment(placeId);
  }
}
