import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { DynamicModule, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ServeStaticModule } from '@nestjs/serve-static';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { DatabaseModule } from './infrastructure/database/database.module';
import { CacheModule } from './infrastructure/cache/cache.module';
import { HealthController } from './health/health.controller';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { PlacesModule } from './modules/places/places.module';
import { ItineraryModule } from './modules/itinerary/itinerary.module';
import { TripsModule } from './modules/trips/trips.module';
import { PlanModule } from './modules/plan/plan.module';
import { SavedPlacesModule } from './modules/saved-places/saved-places.module';
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

/**
 * Serve the built frontend from this same process — the production topology.
 *
 * Single-origin on purpose: the refresh token is an httpOnly `SameSite=Lax`
 * cookie, and Safari, Firefox and Brave all block that cookie on a cross-site
 * XHR. Hosting the SPA and the API on one origin keeps it first-party, so the
 * auth code needs no `SameSite=None` concession and no third-party-cookie bet.
 *
 * ⚠️ Registered ONLY when a built client is actually present. In local dev
 * there is no `client/` directory — Vite serves the app on its own port — so
 * this returns nothing and the dev/E2E topology is completely unaffected.
 *
 * `exclude` matters more than it looks: without it the catch-all would answer
 * unmatched `/api/...` requests with `index.html`, so a wrong endpoint would
 * return HTML instead of a JSON 404 and the client would fail with
 * "Unexpected token <" instead of a readable error.
 */
function serveClientIfBuilt(): DynamicModule[] {
  const clientPath = join(__dirname, '..', 'client');
  if (!existsSync(join(clientPath, 'index.html'))) return [];
  return [
    ServeStaticModule.forRoot({
      rootPath: clientPath,
      // Everything under /api belongs to Nest, never to the static handler.
      exclude: ['/api/(.*)'],
      serveStaticOptions: {
        // Deep links (/social, /profile, …) are client-side routes: fall back
        // to the SPA shell rather than 404ing on a file that never existed.
        fallthrough: true,
      },
    }),
  ];
}

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // Production only — see serveClientIfBuilt(). Empty in dev.
    ...serveClientIfBuilt(),
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
    PlanModule,
    SavedPlacesModule,
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
