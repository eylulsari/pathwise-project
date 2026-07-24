import { Itinerary, RouteGenerationInput } from './itinerary';

/**
 * Strategy Pattern — the port for the route-generation engine.
 * Concrete strategies:
 *   - HubBudgetStrategy  (hub + budget + pace + group filtering/scoring)
 *   - QuizVibeStrategy   (maps quiz → hub + interests, reuses HubBudgetStrategy)
 */
export interface RouteGenerationStrategy {
  generate(input: RouteGenerationInput): Promise<Itinerary>;
}
