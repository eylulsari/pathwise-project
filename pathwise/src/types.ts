/**
 * Shared domain types for the Pathwise frontend.
 * The route/itinerary shapes mirror the backend contract 1:1 so the API
 * responses drop straight in; the social/profile shapes back the mock layer.
 */

// ── Geography ──────────────────────────────────────────────────────
/** Mirrors the backend `Hub` union — see place.ts for why the slugs differ in shape. */
export type Hub =
  | 'sultanahmet'
  | 'eminonu-sirkeci'
  | 'beyoglu-taksim'
  | 'karakoy-galata'
  | 'besiktas-bogaz'
  | 'ortakoy-bebek'
  | 'balat-fener'
  | 'kadikoy-moda'
  | 'uskudar'
  | 'adalar';

export interface HubMeta {
  id: Hub;
  name: string;
  /** `Islands` is the Adalar ferry group — neither shore. */
  side: 'European' | 'Asian' | 'Islands';
  blurb: string;
  center: [number, number]; // [lat, lng]
  accent: string; // hex used for the hub's map/pin accent
}

/** Mirrors the backend `Interest` union. */
export type Interest =
  | 'food'
  | 'history'
  | 'photo'
  | 'market'
  | 'art'
  | 'nature'
  | 'view'
  | 'hiddengem'
  | 'relax'
  | 'local'
  | 'culture'
  | 'nightlife'
  | 'experience'
  | 'religion';

/**
 * The slice of a `Place` that the generated `hubData.ts` carries.
 *
 * The synchronous `PLACES_BY_ID` lookups only ever read these fields, so the
 * artifact ships a projection instead of the whole record — keeping the tips,
 * transit notes and photo prose out of the JS bundle. Anything that needs a
 * full `Place` gets one from the API on an itinerary stop.
 */
export interface PlaceSummary {
  placeId: string;
  name: string;
  hub: Hub;
  lat: number;
  lng: number;
  entryFeeTry: number;
  entryFeeApprox?: boolean;
}

/** What a place physically is — orthogonal to `category`/`Interest`. */
export type PlaceType =
  | 'landmark'
  | 'museum'
  | 'mosque'
  | 'church'
  | 'market'
  | 'food'
  | 'park'
  | 'viewpoint'
  | 'street'
  | 'beach'
  | 'experience';
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
  /** Ticket price is an unverified estimate — render it as "~₺600". Free (0) is never flagged. */
  entryFeeApprox?: boolean;
  avgFoodCostTry: number;
  avgVisitMinutes: number;
  openingHours: string;
  isIndoor: boolean;
  isSunsetSpot: boolean;
  museumPass: boolean;
  localTip: string;

  // ── Extended (optional) attributes ────────────────────────────────
  // Additive metadata layered on top of the Google/IBB-shaped core above.
  // All optional so the original 30 curated places and every existing
  // consumer keep compiling unchanged; newer hubs populate them in full.
  /** What the place physically is — drives map pin icons and type filters. */
  placeType?: PlaceType;
  /** Fine-grained district within the hub (e.g. 'Nişantaşı', 'Büyükada'). */
  neighborhood?: string;
  /** Typical crowd density — drives pacing/queue hints in the UI. */
  crowdLevel?: 'low' | 'medium' | 'high';
  /** Solo-traveler safety score, 0–100 (IBB/community sourced). */
  safetyScore?: number;
  /** Flagged as vetted-comfortable for solo (esp. female) travelers. */
  isSoloVerified?: boolean;
  /** How to get here from the typical previous stop (transit micro-tip). */
  transitNoteBefore?: string;
  /** Specific, actionable local insider tip (distinct from localTip). */
  insiderTip?: string;
  /** When/where the best light is for photos at this spot. */
  photoGoldenHour?: string;
  /** Relative price tier 1 ($) – 4 ($$$$). */
  priceTier?: 1 | 2 | 3 | 4;
  /** Display emoji for map pins / lists. */
  emoji?: string;
  /** Provenance label for the record (e.g. 'Google Places', 'IBB'). */
  source?: string;
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
  /**
   * Opt-in women-traveler mode — all three are optional and default to
   * unset/off. `identifiesAsWoman: null` means "not stated", which is
   * deliberately distinct from `false`.
   *
   * ⚠️ Self-declared, NOT verified: no identity check backs these values, so
   * never render them as a safety guarantee (see `SafetyPreferences` on the
   * backend). Every surface exposing them carries the disclaimer string
   * `social.womenDisclaimer`.
   */
  identifiesAsWoman?: boolean | null;
  visibleToWomenOnly?: boolean;
  showWomenOnly?: boolean;
  /** Reward-points balance (see `PointsSummary`). */
  points?: number;
  createdAt: string;
}

// ── Reward points ──────────────────────────────────────────────────
/**
 * Accrual only for now: points are earned and shown, but there is no reward
 * catalogue and nothing to spend them on yet. The backend keeps a ledger
 * (`point_transactions`) so a real discount/perk system can be built on top
 * without losing the history — see `domain/points.ts` on the backend.
 */
export type PointAction =
  | 'tour_reserved'
  | 'referral'
  | 'route_completed'
  | 'review';

export interface PointTransaction {
  id: string;
  action: PointAction;
  points: number;
  reference: string | null;
  createdAt: string;
}

/** Response of `GET /points/me`. */
export interface PointsSummary {
  points: number;
  /** The server's price list — the UI renders "what earns points" from this. */
  values: Record<PointAction, number>;
  recent: PointTransaction[];
}

/** Response of any endpoint that grants points. */
export interface PointsAward {
  action: PointAction;
  /** 0 when the award was declined (e.g. the daily completion throttle). */
  awarded: number;
  totalPoints: number;
}

/** Partial patch for `PATCH /users/me/safety-preferences`. */
export interface SafetyPreferencesInput {
  identifiesAsWoman?: boolean | null;
  visibleToWomenOnly?: boolean;
  showWomenOnly?: boolean;
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
  /**
   * Self-declared women-traveler status. Absent when the traveler has not
   * stated anything — and also absent for viewers who have not opted in
   * themselves, since the backend redacts it (reciprocity).
   *
   * ⚠️ Self-declared, NOT verified — never render as a safety guarantee.
   */
  identifiesAsWoman?: boolean;

  // ── Buddy matching (see the backend's domain/matching.ts) ──────────
  /** Neighbourhoods this traveler gravitates to. */
  preferredHubs: Hub[];
  /** Coarse spending band; `null` = unknown, which the matcher skips. */
  budgetLevel: BudgetLevel | null;
  /**
   * Compatibility with the signed-in user, 0–100. `null` means there was
   * nothing to compare (a brand-new account) — render no percentage at all
   * rather than inventing one.
   */
  matchScore?: number | null;
  /** The style tags both sides share — what makes the number explainable. */
  sharedStyles?: TravelTag[];
}

/** Coarse spending band used by buddy matching. */
export type BudgetLevel = 'budget' | 'mid' | 'comfort';

/** Response of `GET /social/travelers`. */
export interface TravelerListResult {
  /** Already ranked by `matchScore`, best first. */
  travelers: Traveler[];
  /** False when the backend refused the filter (viewer has not opted in). */
  womenOnlyApplied: boolean;
  /**
   * What the server knows about the caller. Lets the UI explain a thin
   * ranking instead of silently showing weak percentages.
   */
  viewerProfile?: {
    styles: TravelTag[];
    preferredHubs: Hub[];
    budgetLevel: BudgetLevel | null;
  };
}

/**
 * A check-in, as `GET /social/check-ins` returns it.
 *
 * The feed is the union of curated demo entries (whose `createdAt` the server
 * derives from a relative offset, so the feed never ages into all-stale) and
 * real persisted check-ins (whose `createdAt` is a database timestamp). The
 * presence rule reads `createdAt` only and does not care which it got.
 */
export interface CheckIn {
  id: string;
  traveler: Pick<Traveler, 'id' | 'name' | 'avatarColor'>;
  /** `null` when the author did not pick a place ("right here"). */
  placeId: string | null;
  hub: Hub | null;
  message: string;
  /** ISO timestamp — authoritative, and the only input the presence rule needs. */
  createdAt: string;
  /**
   * Resolved client-side from `placeId` against `hubData`.
   *
   * Deliberately NOT resolved by the server: the backend's place dataset is a
   * subset of the frontend's, so resolving there would leave several seed
   * check-ins without a name or a pin.
   */
  placeName: string;
  /** Absent when there is no place — such an entry shows in the feed, not on the map. */
  lat?: number;
  lng?: number;
}

export interface CommunityRoute {
  id: string;
  title: string;
  authorName: string;
  hub: Hub;
  stops: number;
  distanceKm: number;
  /**
   * Static demo baseline + how many people actually liked it. Derived by the
   * server on every read — no total is stored anywhere, so it cannot drift
   * away from the rows behind it.
   */
  likes: number;
  /** Whether the signed-in viewer has liked it. */
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

/**
 * A Q&A thread, as `GET /social/forum` returns it.
 *
 * Questions are a curated seed (there is no "ask a question" UI); **answers**
 * are persisted and merged into their thread by the server. Both carry a real
 * `createdAt` — seed entries have theirs derived from a relative offset at
 * read time, so a thread never ages into claiming to be days old.
 */
export interface ForumAnswer {
  authorName: string;
  text: string;
  createdAt: string;
}

export interface ForumQuestion {
  id: string;
  authorName: string;
  question: string;
  createdAt: string;
  /** Oldest first — a thread reads top to bottom. */
  answers: ForumAnswer[];
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
