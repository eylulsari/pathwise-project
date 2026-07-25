import { Module } from '@nestjs/common';
import { WeatherService } from './application/weather.service';
import { WeatherController } from './infrastructure/http/weather.controller';

/**
 * Live Istanbul weather via OpenWeatherMap. ConfigService (key) and Redis are
 * both global. Degrades to a static mock when the key is missing or the call
 * fails — never load-bearing.
 */
@Module({
  controllers: [WeatherController],
  providers: [WeatherService],
})
export class WeatherModule {}
