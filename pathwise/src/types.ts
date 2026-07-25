/**
 * Shared domain types for the Pathwise frontend.
 * The route/itinerary shapes mirror the backend contract 1:1 so the API
 * responses drop straight in; the social/profile shapes back the mock layer.
 */

// ── Geography ──────────────────────────────────────────────────────
export type Hub =
  | 'sultanahmet'
  | 'karakoy-galata'
  | 'kadikoy-moda'
  | 'balat-fener'
  | 'besiktas-bogaz';

export interface HubMeta {
  id: Hub;
  name: string;
  side: 'European' | 'Asian';
  blurb: string;
  center: [number, number]; // [lat, lng]
  accent: string; // hex used for the hub's map/pin accent
}

export type Interest = 'food' | 'history' | 'photo' | 'market' | 'art' | 'nature';
export type GroupType = 'solo' | 'couple' | 'friends';
export type Weather = 'sunny' | 'rainy';
export type RouteMode = 'hub-budget' | 'quiz-vibe';

// ── Places (Google Places + IBB shaped) ────────────────────────────
export interface Place {
  placeId: string;
  name: string;
  hub: Hub;
  lat: number;
  lng: number;
  rating: number;
  reviewCount: number;
  photoUrl: string;
  category: Interest;
  interests: Interest[];
  entryFeeTry: number;
  avgFoodCostTry: number;
  avgVisitMinutes: number;
  openingHours: string;
  isIndoor: boolean;
  isSunsetSpot: boolean;
  museumPass: boolean;
  localTip: string;
}

// ── Itinerary (mirrors backend response) ───────────────────────────
export type TransportMode = 'walk' | 'ferry' | 'metro' | 'tram' | 'bus';

export interface TransportLeg {
  mode: TransportMode;
  label: string;
  distanceMeters: number;
  durationMinutes: number;
}

export interface Reservation {
  placeId: string;
  time: string; // "HH:mm"
  confirmationCode?: string;
  note?: string;
}

export interface ItineraryStop {
  order: number;
  place: Place | null; // null → synthetic Lunch Break
  isLunchBreak: boolean;
  arrivalTime: string;
  departureTime: string;
  durationMinutes: number;
  entryFeeTry: number;
  foodCostTry: number;
  transportToNext: TransportLeg | null;
  reservation?: { time: string; confirmationCode?: string; note?: string };
}

// ── Reviews (Phase 3) ──────────────────────────────────────────────
export interface Review {
  id: string;
  authorName: string;
  rating: number;
  comment: string;
  helpfulCount: number;
  createdAt: string;
}
export interface ReviewsResponse {
  average: number;
  count: number;
  reviews: Review[];
}

// ── Live place enrichment (OSM/Overpass + Wikipedia) ───────────────
export interface OsmEnrichment {
  openingHours: string | null;
  openingHoursRaw: string | null;
  wheelchair: string | null; // 'yes' | 'no' | 'limited'
  cuisine: string | null;
  source: 'overpass';
}
export interface WikipediaEnrichment {
  title: string;
  summary: string;
  thumbnailUrl: string | null;
  pageUrl: string;
  attribution: 'Wikipedia';
}
export interface PlaceEnrichment {
  placeId: string;
  osm: OsmEnrichment | null;
  wikipedia: WikipediaEnrichment | null;
}

export interface NearbySuggestion {
  place: Place;
  nearPlaceName: string;
  distanceMeters: number;
  walkMinutes: number;
}

// ── Trip Journal (B1) ──────────────────────────────────────────────
export interface JournalEntry {
  id: string;
  placeId: string;
  photoUrl: string | null;
  note: string | null;
  rating: number; // 1–5
  createdAt: string;
}

export interface JournalSummary {
  entryCount: number;
  photoCount: number;
  noteCount: number;
  avgRating: number;
  categoryRatings: Partial<Record<Interest, number>>;
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

export interface GenerateRouteRequest {
  mode: RouteMode;
  hub?: Hub;
  budgetTry: number;
  paceHours: number;
  group: GroupType;
  interests?: Interest[];
  mustVisitIds?: string[];
  weather: Weather;
  startHour: number;
  startOrigin?: Origin;
  endOrigin?: Origin;
  reservations?: Reservation[];
  quiz?: {
    mood: 'history' | 'foodie' | 'art' | 'photo';
    pace: 'relaxed' | 'moderate' | 'packed';
    budgetTry: number;
  };
}

/** Order-preserving recompute after a manual drag-and-drop reorder. */
export interface RebuildRouteRequest {
  placeIds: string[];
  hub?: Hub;
  budgetTry: number;
  paceHours: number;
  group: GroupType;
  weather: Weather;
  startHour: number;
  startOrigin?: Origin;
  endOrigin?: Origin;
  reservations?: Reservation[];
}

// ── Start / end point selector ─────────────────────────────────────
export type StartPointKind = 'gps' | 'hotel' | 'transit' | 'map';
export interface StartPoint {
  kind: StartPointKind;
  label: string;
  lat: number;
  lng: number;
}

/** A start/end anchor sent to the route engine. */
export interface Origin {
  lat: number;
  lng: number;
  label: string;
}

// ── Auth / user ────────────────────────────────────────────────────
export type SubscriptionTier = 'free' | 'premium' | 'trial';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  nationality?: string | null;
  age?: number | null;
  travelStyles: string[];
  bio?: string | null;
  subscriptionTier: SubscriptionTier;
  trialEndsAt?: string | null;
  isPremium?: boolean; // backend-computed (tier OR active trial/reward window)
  createdAt: string;
}

export interface UsageInfo {
  tier: SubscriptionTier;
  optimizeUsed: number;
  optimizeLimit: number | null; // null = unlimited (premium)
}

// ── Notification Center (B6) ───────────────────────────────────────
export type NotificationType =
  | 'reservation' | 'trial' | 'poll' | 'nearby' | 'budget' | 'sos' | 'welcome';

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
}

export interface AuthResponse {
  user: AuthUser;
  accessToken: string;
  // The refresh token is delivered as an httpOnly cookie, not in the body.
}

// ── Social network ─────────────────────────────────────────────────
export type TravelTag =
  | '#SoloVerified'
  | '#Foodie'
  | '#Backpacker'
  | '#CultureSeeker'
  | '#PhotoNomad'
  | '#SlowTravel';

export interface Traveler {
  id: string;
  name: string;
  age: number;
  nationality: string;
  avatarColor: string;
  tags: TravelTag[];
  bio: string;
  soloVerified: boolean;
  visitedProvinces: string[]; // Turkish province names
  badges: string[]; // badge ids earned
}

export interface CheckIn {
  id: string;
  traveler: Pick<Traveler, 'id' | 'name' | 'avatarColor'>;
  placeName: string;
  hub: Hub;
  message: string;
  minutesAgo: number;
}

export interface CommunityRoute {
  id: string;
  title: string;
  authorName: string;
  hub: Hub;
  stops: number;
  distanceKm: number;
  likes: number;
  liked: boolean;
  tags: Interest[];
}

// ── Group Poll (B3) ────────────────────────────────────────────────
export interface PollOption {
  id: string;
  placeId: string;
  label: string;
  votes: number;
}
export interface Poll {
  id: string;
  creatorUserId: string;
  question: string;
  options: PollOption[];
  status: 'open' | 'closed';
  winnerPlaceId: string | null;
  createdAt: string;
}

export interface ForumQuestion {
  id: string;
  authorName: string;
  question: string;
  minutesAgo: number;
  answers: { authorName: string; text: string; minutesAgo: number }[];
}

// ── Profile ────────────────────────────────────────────────────────
export interface Badge {
  id: string;
  emoji: string;
  name: string;
  description: string;
  earned: boolean;
  progress: number; // 0–100
}

export interface PastTrip {
  id: string;
  title: string;
  hub: Hub;
  date: string; // ISO date
  distanceKm: number;
  stops: number;
  spentTry: number;
}

export interface ProfileStats {
  totalKm: number;
  stopsVisited: number;
  spentTry: number;
}

/** A trip saved to the backend (Postgres) for the signed-in user. */
export interface SavedTrip {
  id: string;
  title: string;
  hub: Hub;
  totalDistanceKm: number;
  totalCostTry: number;
  stopCount: number;
  itinerary: Itinerary;
  createdAt: string;
}

// ── Curated / live tours ───────────────────────────────────────────
export type TourSource = 'GetYourGuide' | 'TripAdvisor' | 'Pathwise';
export interface Tour {
  id: string;
  title: string;
  hub: Hub;
  source: TourSource;
  durationHours: number;
  priceTry: number;
  rating: number;
  stopNames: string[];
  live: boolean; // synced via "Sync Live Tours"
  /** Partner booking link (mock ?ref=pathwise; real affiliate later). */
  affiliateUrl: string;
  /** Sponsored placement — badged and surfaced to the top; hidden for premium. */
  isSponsored: boolean;
}

// ── AI assistant ───────────────────────────────────────────────────
export interface AiSuggestion {
  placeId: string;
  name: string;
  reason: string;
  costTry: number;
  safety: 'safe' | 'caution';
}
