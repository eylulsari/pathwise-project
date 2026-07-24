import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ItineraryService } from '../../application/itinerary.service';
import {
  GenerateRouteDto,
  RebuildRouteDto,
} from '../../application/dto/generate-route.dto';

@Controller('itinerary')
export class ItineraryController {
  constructor(private readonly itinerary: ItineraryService) {}

  /**
   * POST /api/itinerary/generate
   * Public (no auth) so the landing/quiz can preview a route before sign-up.
   */
  @Post('generate')
  @HttpCode(HttpStatus.OK)
  generate(@Body() dto: GenerateRouteDto) {
    return this.itinerary.generate(dto);
  }

  /**
   * POST /api/itinerary/rebuild
   * Recompute times/transport/budget for a manually reordered stop list
   * (drag-and-drop) without re-optimizing the order.
   */
  @Post('rebuild')
  @HttpCode(HttpStatus.OK)
  rebuild(@Body() dto: RebuildRouteDto) {
    return this.itinerary.rebuild(dto);
  }
}
