import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ItineraryService } from '../../application/itinerary.service';
import { OptimizeLimitGuard } from '../../../../common/guards/optimize-limit.guard';
import { JwtAuthGuard } from '../../../auth/infrastructure/guards/jwt-auth.guard';
import { CurrentUser } from '../../../auth/infrastructure/decorators/current-user.decorator';
import { AuthUser } from '../../../auth/domain/auth-user';
import {
  GenerateRouteDto,
  OptimizeRouteDto,
  RebuildRouteDto,
  SuggestNearbyDto,
} from '../../application/dto/generate-route.dto';

@Controller('itinerary')
export class ItineraryController {
  constructor(private readonly itinerary: ItineraryService) {}

  /**
   * GET /api/itinerary/day-plan?days=7 — which hub each day is built around.
   *
   * Server-side because it is a planning rule, not a layout choice: it depends
   * on which shore each hub is on and on the islands needing a whole day, both
   * of which the backend owns. Deciding it in the client would put a second
   * copy of that knowledge where it could drift.
   */
  @Get('day-plan')
  dayPlan(@Query('days') days?: string) {
    return { hubs: this.itinerary.planDays(Number(days)) };
  }

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
   * POST /api/itinerary/optimize — a shorter order for a day that already
   * exists, with the original returned alongside so it can be put back.
   *
   * Behind the same daily limit as `generate`: this is the paid-for work —
   * it runs the search and two assemblies — and leaving it un-guarded would
   * be a way around the free plan's cap rather than a feature of it.
   */
  @UseGuards(OptimizeLimitGuard)
  @Post('optimize')
  @HttpCode(HttpStatus.OK)
  optimize(@Body() dto: OptimizeRouteDto) {
    return this.itinerary.optimize(dto);
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
