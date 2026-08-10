import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SocialService } from './application/social.service';
import { MatchingService } from './application/matching.service';
import { CheckInsService } from './application/check-ins.service';
import { SocialController } from './infrastructure/http/social.controller';
import { CheckInOrmEntity } from './infrastructure/persistence/check-in.orm-entity';
import { TypeOrmCheckInRepository } from './infrastructure/persistence/typeorm-check-in.repository';
import { CHECK_IN_REPOSITORY } from './domain/check-in.repository.port';
import { UsersModule } from '../users/users.module';
import { TripsModule } from '../trips/trips.module';

/**
 * Social / Traveler Buddy Finder. Serves the buddy list from the API so the
 * opt-in women-traveler filter can be enforced server-side (the frontend mock
 * stays as an offline fallback).
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([CheckInOrmEntity]),
    UsersModule, // the caller's own safety preferences + travel styles
    TripsModule, // saved trips → preferred hubs + budget level (Görev 2)
  ],
  controllers: [SocialController],
  providers: [
    SocialService,
    MatchingService,
    CheckInsService,
    { provide: CHECK_IN_REPOSITORY, useClass: TypeOrmCheckInRepository },
  ],
  exports: [SocialService, MatchingService, CheckInsService],
})
export class SocialModule {}
