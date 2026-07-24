import { Injectable } from '@nestjs/common';
import { Interest } from '../../places/domain/place';
import { Itinerary, RouteGenerationInput } from '../domain/itinerary';
import { RouteStrategyFactory } from './route-strategy.factory';
import { HubBudgetStrategy } from './strategies/hub-budget.strategy';
import { GenerateRouteDto, RebuildRouteDto } from './dto/generate-route.dto';

/**
 * Application service for itinerary generation. Normalizes the request DTO into
 * the domain input, asks the factory for the right strategy, and runs it.
 */
@Injectable()
export class ItineraryService {
  constructor(
    private readonly factory: RouteStrategyFactory,
    // Injected directly for rebuild (order-preserving re-assembly) — this is
    // inherently the hub-budget engine's assembly step, not a new strategy.
    private readonly hubBudget: HubBudgetStrategy,
  ) {}

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
      startOrigin: dto.startOrigin,
      endOrigin: dto.endOrigin,
      quiz: dto.quiz,
    };

    const strategy = this.factory.create(dto.mode);
    return strategy.generate(input);
  }

  /** Recompute an itinerary from an explicit, user-defined stop order. */
  async rebuild(dto: RebuildRouteDto): Promise<Itinerary> {
    const input: RouteGenerationInput = {
      hub: dto.hub,
      budgetTry: dto.budgetTry,
      paceHours: dto.paceHours,
      group: dto.group,
      interests: [],
      mustVisitIds: [],
      weather: dto.weather,
      startHour: dto.startHour,
      startOrigin: dto.startOrigin,
      endOrigin: dto.endOrigin,
    };
    return this.hubBudget.rebuild(dto.placeIds, input);
  }
}
