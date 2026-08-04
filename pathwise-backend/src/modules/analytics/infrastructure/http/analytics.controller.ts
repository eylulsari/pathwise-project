import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { IsIn, IsString, MaxLength } from 'class-validator';
import {
  AnalyticsService,
  PAYWALL_FEATURES,
  PaywallFeature,
} from '../../application/analytics.service';
import { PointsService } from '../../../points/application/points.service';
import { JwtAuthGuard } from '../../../auth/infrastructure/guards/jwt-auth.guard';
import { CurrentUser } from '../../../auth/infrastructure/decorators/current-user.decorator';
import { AuthUser } from '../../../auth/domain/auth-user';

class PaywallDto {
  @IsIn(PAYWALL_FEATURES as unknown as string[])
  feature: PaywallFeature;
}

class AffiliateClickDto {
  @IsString()
  @MaxLength(120)
  tourId: string;

  @IsString()
  @MaxLength(40)
  source: string;
}

@UseGuards(JwtAuthGuard)
@Controller()
export class AnalyticsController {
  constructor(
    private readonly analytics: AnalyticsService,
    private readonly points: PointsService,
  ) {}

  /** POST /api/analytics/paywall — record a client-side paywall hit. */
  @Post('analytics/paywall')
  @HttpCode(HttpStatus.NO_CONTENT)
  async paywall(@Body() dto: PaywallDto) {
    await this.analytics.recordPaywall(dto.feature);
  }

  /**
   * POST /api/analytics/affiliate-click — record an affiliate link click (A7)
   * and award the reservation reward points.
   *
   * This is the "Reserve/Book" action from the user's point of view, so it is
   * where the reward is granted; it answers 200 with the award (it used to be
   * a 204) so the tours panel can toast the exact number the server credited
   * instead of guessing it client-side.
   *
   * NOTE: a click is not a confirmed booking — we cannot see the partner's
   * funnel. Points are deliberately granted on intent, which is also why the
   * per-action value is small. TODO(rewards): if a partner postback/webhook is
   * ever wired up, move the award behind the confirmation event.
   */
  @Post('analytics/affiliate-click')
  @HttpCode(HttpStatus.OK)
  async affiliateClick(@CurrentUser() user: AuthUser, @Body() dto: AffiliateClickDto) {
    await this.analytics.recordAffiliateClick(user.id, dto.tourId, dto.source);
    return this.points.award(user.id, 'tour_reserved', dto.tourId);
  }

  /**
   * GET /api/admin/analytics — paywall hits per feature + affiliate clicks.
   * TODO: restrict to an admin role once roles exist.
   */
  @Get('admin/analytics')
  async stats() {
    return {
      paywall: await this.analytics.paywallStats(),
      affiliate: await this.analytics.affiliateStats(),
    };
  }
}
