import { Controller, Get } from '@nestjs/common';
import { WeatherService, WeatherCrowd } from '../../application/weather.service';

@Controller('weather')
export class WeatherController {
  constructor(private readonly weather: WeatherService) {}

  /** GET /api/weather — current Istanbul conditions + heuristic crowd level. */
  @Get()
  getCurrent(): Promise<WeatherCrowd> {
    return this.weather.getCurrent();
  }
}
