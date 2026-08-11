import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { DatabaseModule } from './infrastructure/database/database.module';
import { CacheModule } from './infrastructure/cache/cache.module';
import { HealthController } from './health/health.controller';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { PlacesModule } from './modules/places/places.module';
import { ItineraryModule } from './modules/itinerary/itinerary.module';
import { TripsModule } from './modules/trips/trips.module';
import { PremiumModule } from './modules/premium/premium.module';
import { ModerationModule } from './modules/moderation/moderation.module';
import { JournalModule } from './modules/journal/journal.module';
import { ReferralModule } from './modules/referral/referral.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { PollsModule } from './modules/polls/polls.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { PointsModule } from './modules/points/points.module';
import { ReviewsModule } from './modules/reviews/reviews.module';
import { SafetyModule } from './modules/safety/safety.module';
import { SocialModule } from './modules/social/social.module';
import { CurrencyModule } from './modules/currency/currency.module';
import { WeatherModule } from './modules/weather/weather.module';
import { AssistantModule } from './modules/assistant/assistant.module';

// Feature modules (modular monolith — each is a clean boundary).

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // Global rate limit: 100 requests / 60s per IP (auth routes tighten this).
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),
    DatabaseModule,
    CacheModule,
    // ── feature modules ──
    UsersModule,
    AuthModule,
    PlacesModule,
    ItineraryModule,
    TripsModule,
    PremiumModule,
    ModerationModule,
    JournalModule,
    ReferralModule,
    NotificationsModule,
    PollsModule,
    AnalyticsModule,
    PointsModule,
    ReviewsModule,
    SafetyModule,
    SocialModule,
    CurrencyModule,
    WeatherModule,
    AssistantModule,
  ],
  controllers: [HealthController],
  providers: [
    // Apply the rate limiter globally.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
