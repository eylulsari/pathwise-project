import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TripsService } from './application/trips.service';
import { TripsController } from './infrastructure/http/trips.controller';
import { TripOrmEntity } from './infrastructure/persistence/trip.orm-entity';
import { TypeOrmTripRepository } from './infrastructure/persistence/typeorm-trip.repository';
import { TRIP_REPOSITORY } from './domain/trip.repository.port';

@Module({
  imports: [TypeOrmModule.forFeature([TripOrmEntity])],
  controllers: [TripsController],
  providers: [
    TripsService,
    { provide: TRIP_REPOSITORY, useClass: TypeOrmTripRepository },
  ],
  // Exported so buddy matching can derive preferred hubs / budget level from
  // a user's saved trips (SocialModule → MatchingService).
  exports: [TripsService],
})
export class TripsModule {}
