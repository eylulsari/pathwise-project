import { Hub, Interest, Place } from '../../places/domain/place';

export type GroupType = 'solo' | 'couple' | 'friends';
export type Weather = 'sunny' | 'rainy';
export type RouteMode = 'hub-budget' | 'quiz-vibe';

/** A start or end anchor for the day (GPS/hotel/transit/map point). */
export interface Origin {
  lat: number;
  lng: number;
  label: string;
}

/** A booking pinned to a specific place — its scheduled time is fixed and the
 *  rest of the day is re-timed around it. */
export interface Reservation {
  placeId: string;
  time: string; // "HH:mm"
  confirmationCode?: string;
  note?: string;
}

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
  /** Where the day starts (used to seed the route order). */
  startOrigin?: Origin;
  /** Where the day should end. When omitted the engine auto-suggests one. */
  endOrigin?: Origin;
  /** Pinned bookings whose times must not move. */
  reservations?: Reservation[];
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
  /** Present when the user pinned a booking to this stop (time is fixed). */
  reservation?: { time: string; confirmationCode?: string; note?: string };
}

/**
 * Something the traveller needs to know about the shape of this day, as a code
 * rather than a sentence: the backend does not know which language the reader
 * chose, and a warning shipped in the wrong one is a warning nobody reads.
 */
export type ItineraryNoticeCode =
  /** Stops from another hub were dropped because Adalar is a day of its own. */
  | 'adalar-separate-day'
  /** The plan runs late enough to risk the last ferry back from the islands. */
  | 'adalar-last-ferry'
  /** Routine reminder that an island day has to catch a boat home. */
  | 'adalar-return-ferry'
  /** The day crosses the Bosphorus — real, doable, and worth an hour of it. */
  | 'cross-side-day';

export interface ItineraryNotice {
  code: ItineraryNoticeCode;
  severity: 'info' | 'warning';
  /** Place names the notice is about, for interpolation into the message. */
  places?: string[];
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
  /** Empty on an ordinary day; never null, so the UI can map it unguarded. */
  notices: ItineraryNotice[];
  generatedAt: string;
}
