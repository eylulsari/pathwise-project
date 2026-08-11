import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { UsersService } from '../users/application/users.service';
import { PlacesService } from '../places/application/places.service';
import { JwtAuthGuard } from '../auth/infrastructure/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/infrastructure/decorators/current-user.decorator';
import { AuthUser } from '../auth/domain/auth-user';
import { PremiumGuard } from '../../common/guards/premium.guard';
import { MemoryStoreService } from '../../infrastructure/cache/memory-store.service';
import { NotificationsService } from '../notifications/application/notifications.service';
import {
  FREE_OPTIMIZE_LIMIT,
  optimizeDailyKey,
} from '../../common/guards/optimize-limit.constants';
import { SubscriptionDto } from './dto/subscription.dto';

@UseGuards(JwtAuthGuard)
@Controller('premium')
export class PremiumController {
  constructor(
    private readonly users: UsersService,
    private readonly places: PlacesService,
    private readonly store: MemoryStoreService,
    private readonly notifications: NotificationsService,
  ) {}

  /** POST /api/premium/subscription — demo upgrade/downgrade (no real payment). */
  @Post('subscription')
  @HttpCode(HttpStatus.OK)
  setSubscription(@CurrentUser() user: AuthUser, @Body() dto: SubscriptionDto) {
    // TODO: gate behind a verified Stripe/İyzico payment webhook.
    return this.users.setSubscriptionTier(user.id, dto.tier);
  }

  /** GET /api/premium/usage — tier + today's optimize usage for the client UI. */
  @Get('usage')
  async usage(@CurrentUser() user: AuthUser) {
    const full = await this.users.findById(user.id);
    const used = await this.store.getCount(optimizeDailyKey(user.id));

    // A6 — if the trial ends within 24h, drop a one-time reminder (B6).
    if (full.trialEndsAt) {
      const msLeft = full.trialEndsAt.getTime() - Date.now();
      if (msLeft > 0 && msLeft < 86400 * 1000) {
        if (!(await this.notifications.hasType(user.id, 'trial'))) {
          await this.notifications.notify(
            user.id,
            'trial',
            '⏳ Trial ending soon',
            'Your Premium trial ends within a day — upgrade to keep unlimited planning.',
          );
        }
      }
    }

    return {
      tier: full.subscriptionTier,
      optimizeUsed: used,
      optimizeLimit: full.isPremium ? null : FREE_OPTIMIZE_LIMIT,
    };
  }

  /**
   * GET /api/premium/audio-guide/:placeId — the FULL audio-guide transcript.
   * Premium only; free users get 402 (they see the short preview client-side).
   */
  @UseGuards(PremiumGuard)
  @Get('audio-guide/:placeId')
  async audioGuide(@Param('placeId') placeId: string) {
    const [place] = await this.places.findByIds([placeId]);
    const name = place?.name ?? 'this stop';
    return {
      placeId,
      durationSeconds: 180,
      transcript:
        `Welcome to ${name}. This is the full ${'~3-minute'} premium audio guide. ` +
        `${place?.localTip ?? ''} Beyond the highlights, notice the layers of history in the ` +
        `stonework, the way the light falls through the day, and the stories the locals tell. ` +
        `Take your time here — the full guide walks you through every corner worth seeing.`,
    };
  }
}
