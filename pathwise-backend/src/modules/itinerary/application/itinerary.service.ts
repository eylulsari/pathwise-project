import { Injectable } from '@nestjs/common';
import { Interest } from '../../places/domain/place';
import { Itinerary, RouteGenerationInput } from '../domain/itinerary';
import { RouteStrategyFactory } from './route-strategy.factory';
import { GenerateRouteDto } from './dto/generate-route.dto';

/**
 * Application service for itinerary generation. Normalizes the request DTO into
 * the domain input, asks the factory for the right strategy, and runs it.
 */
@Injectable()
export class ItineraryService {
  constructor(private readonly factory: RouteStrategyFactory) {}

  async generate(dto: GenerateRouteDto): Promise<Itinerary> {
    const input: RouteGenerationInput = {
      hub: dto.hub,
      budgetTry: dto.budgetTry,
      paceHours: dto.paceHours,
      group: dto.group,
      interests: (dto.interests ?? []) as Interest[],
      mustVisitIds: dto.mustVisitIds ?? [],
      weather: dto.weather,
      startHour: dto.startHour,
      quiz: dto.quiz,
    };

    const strategy = this.factory.create(dto.mode);
    return strategy.generate(input);
  }
}
