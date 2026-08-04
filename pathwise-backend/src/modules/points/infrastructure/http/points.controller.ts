import { Controller, Get, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { PointsService } from '../../application/points.service';
import { JwtAuthGuard } from '../../../auth/infrastructure/guards/jwt-auth.guard';
import { CurrentUser } from '../../../auth/infrastructure/decorators/current-user.decorator';
import { AuthUser } from '../../../auth/domain/auth-user';

@UseGuards(JwtAuthGuard)
@Controller('points')
export class PointsController {
  constructor(private readonly points: PointsService) {}

  /** GET /api/points/me — balance, price list and recent awards. */
  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return this.points.getSummary(user.id);
  }

  /**
   * POST /api/points/route-completed — the day's route was finished.
   *
   * Called by the dashboard when the last stop is ticked off. Answers 200 with
   * `awarded: 0` (not an error) when the daily throttle declines it, so the
   * client can simply skip the toast instead of handling a failure.
   */
  @Post('route-completed')
  @HttpCode(HttpStatus.OK)
  routeCompleted(@CurrentUser() user: AuthUser) {
    return this.points.awardRouteCompletion(user.id);
  }
}
