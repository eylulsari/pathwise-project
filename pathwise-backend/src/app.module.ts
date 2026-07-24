import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './infrastructure/database/database.module';
import { RedisModule } from './infrastructure/redis/redis.module';
import { HealthController } from './health/health.controller';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { PlacesModule } from './modules/places/places.module';
import { ItineraryModule } from './modules/itinerary/itinerary.module';
import { TripsModule } from './modules/trips/trips.module';

// Feature modules (modular monolith — each is a clean boundary).

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    RedisModule,
    // ── feature modules ──
    UsersModule,
    AuthModule,
    PlacesModule,
    ItineraryModule,
    TripsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
