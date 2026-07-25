import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ItineraryService } from '../../application/itinerary.service';
import { OptimizeLimitGuard } from '../../../../common/guards/optimize-limit.guard';
import { JwtAuthGuard } from '../../../auth/infrastructure/guards/jwt-auth.guard';
import { CurrentUser } from '../../../auth/infrastructure/decorators/current-user.decorator';
import { AuthUser } from '../../../auth/domain/auth-user';
import {
  GenerateRouteDto,
  RebuildRouteDto,
  SuggestNearbyDto,
} from '../../application/dto/generate-route.dto';

@Controller('itinerary')
export class ItineraryController {
  constructor(private readonly itinerary: ItineraryService) {}

  /**
   * POST /api/itinerary/generate
   * Public (no auth) so the landing/quiz can preview a route before sign-up.
   */
  @UseGuards(OptimizeLimitGuard)
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

  /**
   * POST /api/itinerary/suggest-nearby — one "add this too" candidate,
   * personalized by the signed-in user's Trip Journal category ratings (A4).
   */
  @UseGuards(JwtAuthGuard)
  @Post('suggest-nearby')
  @HttpCode(HttpStatus.OK)
  suggestNearby(@CurrentUser() user: AuthUser, @Body() dto: SuggestNearbyDto) {
    return this.itinerary.suggestNearby(dto.hub, dto.placeIds, user.id);
  }
}
