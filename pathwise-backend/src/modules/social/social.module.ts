import { Module } from '@nestjs/common';
import { SocialService } from './application/social.service';
import { MatchingService } from './application/matching.service';
import { SocialController } from './infrastructure/http/social.controller';
import { UsersModule } from '../users/users.module';
import { TripsModule } from '../trips/trips.module';

/**
 * Social / Traveler Buddy Finder. Serves the buddy list from the API so the
 * opt-in women-traveler filter can be enforced server-side (the frontend mock
 * stays as an offline fallback).
 */
@Module({
  imports: [
    UsersModule, // the caller's own safety preferences + travel styles
    TripsModule, // saved trips → preferred hubs + budget level (Görev 2)
  ],
  controllers: [SocialController],
  providers: [SocialService, MatchingService],
  exports: [SocialService, MatchingService],
})
export class SocialModule {}
