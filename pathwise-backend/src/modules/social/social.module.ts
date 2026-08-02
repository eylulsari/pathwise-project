import { Module } from '@nestjs/common';
import { SocialService } from './application/social.service';
import { SocialController } from './infrastructure/http/social.controller';
import { UsersModule } from '../users/users.module';

/**
 * Social / Traveler Buddy Finder. Serves the buddy list from the API so the
 * opt-in women-traveler filter can be enforced server-side (the frontend mock
 * stays as an offline fallback).
 */
@Module({
  imports: [UsersModule], // needs the caller's own safety preferences
  controllers: [SocialController],
  providers: [SocialService],
  exports: [SocialService],
})
export class SocialModule {}
