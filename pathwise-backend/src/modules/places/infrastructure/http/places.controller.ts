import { Controller, Get, Param, Query } from '@nestjs/common';
import { PlacesService } from '../../application/places.service';
import { EnrichmentService } from '../../application/enrichment.service';
import {
  NarrationService,
  narrationLang,
} from '../../application/narration.service';
import { Hub } from '../../domain/place';
import { HUB_DATASET, TRANSIT_HUBS } from '../persistence/hub.dataset';

@Controller('places')
export class PlacesController {
  constructor(
    private readonly places: PlacesService,
    private readonly enrichment: EnrichmentService,
    private readonly narrationService: NarrationService,
  ) {}

  /** GET /api/places  — optionally ?hub=<hub> */
  @Get()
  list(@Query('hub') hub?: Hub) {
    return hub ? this.places.findByHub(hub) : this.places.findAll();
  }

  /**
   * GET /api/places/hubs — hub metadata (name, blurb, map centre, accent) plus
   * the transit start points. Nested under /places rather than given its own
   * controller because hubs are an attribute of the place dataset, not a
   * separate resource with its own lifecycle.
   */
  @Get('hubs')
  hubs() {
    return { hubs: HUB_DATASET, transitHubs: TRANSIT_HUBS };
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

  /**
   * GET /api/places/:placeId/narration?lang=tr — a short audio-guide script.
   *
   * Returns `{ narration: null }` rather than a 404 when there is nothing to
   * say: a place with no Wikipedia article, or narration not configured, is a
   * normal state the panel hides itself for, not a failure the client should
   * surface as an error.
   */
  @Get(':placeId/narration')
  async narration(
    @Param('placeId') placeId: string,
    @Query('lang') lang?: string,
  ) {
    return {
      narration: await this.narrationService.forPlace(placeId, narrationLang(lang)),
    };
  }
}
