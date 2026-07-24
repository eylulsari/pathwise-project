import { Hub, Interest, Place } from '../../places/domain/place';

export type GroupType = 'solo' | 'couple' | 'friends';
export type Weather = 'sunny' | 'rainy';
export type RouteMode = 'hub-budget' | 'quiz-vibe';

/** Quiz answers (Travel Vibe Quiz) — consumed by QuizVibeStrategy. */
export interface QuizInput {
  mood: 'history' | 'foodie' | 'art' | 'photo';
  pace: 'relaxed' | 'moderate' | 'packed';
  budgetTry: number;
}

/**
 * Normalized input every strategy operates on. For quiz-vibe mode the `quiz`
 * field is set and QuizVibeStrategy fills in `hub`/`interests` before
 * delegating to HubBudgetStrategy.
 */
export interface RouteGenerationInput {
  hub?: Hub;
  budgetTry: number;
  paceHours: number;
  group: GroupType;
  interests: Interest[];
  mustVisitIds: string[];
  weather: Weather;
  startHour: number; // 0–23, when the day begins
  quiz?: QuizInput;
}

export type TransportMode = 'walk' | 'ferry' | 'metro' | 'tram' | 'bus';

/** A transport leg between two consecutive stops. */
export interface TransportLeg {
  mode: TransportMode;
  label: string; // e.g. "🚶 8 min walk (650m)"
  distanceMeters: number;
  durationMinutes: number;
}

export interface ItineraryStop {
  order: number;
  place: Place | null; // null for a synthetic Lunch Break
  isLunchBreak: boolean;
  arrivalTime: string; // "HH:mm"
  departureTime: string; // "HH:mm"
  durationMinutes: number;
  entryFeeTry: number;
  foodCostTry: number;
  transportToNext: TransportLeg | null;
}

export interface Itinerary {
  hub: Hub;
  mode: RouteMode;
  group: GroupType;
  weather: Weather;
  stops: ItineraryStop[];
  costBreakdown: {
    ticketsTry: number;
    foodTry: number;
    transportTry: number;
    totalTry: number;
  };
  budgetTry: number;
  overBudget: boolean;
  totalDistanceKm: number;
  totalDurationMinutes: number;
  generatedAt: string;
}
