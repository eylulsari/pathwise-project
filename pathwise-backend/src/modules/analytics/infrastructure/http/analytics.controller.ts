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
  constructor(private readonly analytics: AnalyticsService) {}

  /** POST /api/analytics/paywall — record a client-side paywall hit. */
  @Post('analytics/paywall')
  @HttpCode(HttpStatus.NO_CONTENT)
  async paywall(@Body() dto: PaywallDto) {
    await this.analytics.recordPaywall(dto.feature);
  }

  /** POST /api/analytics/affiliate-click — record an affiliate link click (A7). */
  @Post('analytics/affiliate-click')
  @HttpCode(HttpStatus.NO_CONTENT)
  async affiliateClick(@CurrentUser() user: AuthUser, @Body() dto: AffiliateClickDto) {
    await this.analytics.recordAffiliateClick(user.id, dto.tourId, dto.source);
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
