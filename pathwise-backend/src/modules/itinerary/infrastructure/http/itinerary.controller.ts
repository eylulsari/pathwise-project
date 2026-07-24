import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ItineraryService } from '../../application/itinerary.service';
import { GenerateRouteDto } from '../../application/dto/generate-route.dto';

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
}
