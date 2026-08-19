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
  | 'adalar'
  | 'eyupsultan'
  | 'sariyer'
  | 'nisantasi-sisli'
  | 'beykoz-anadolu-kavagi'
  | 'zeytinburnu-bakirkoy';

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
  | 'religion'
  | 'walk'
  | 'architecture'
  | 'family';

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
/** Mirrors the backend `GroupType` — the quiz's "who with?" sets this. */
export type GroupType = 'solo' | 'couple' | 'family' | 'friends';
export type WalkingTolerance = 'short' | 'moderate' | 'long';
/**
 * Only ever sent to the assistant. The route engine does not take it, because
 * no place in the catalogue records whether it can feed someone who is vegan —
 * see the note on the backend's `DietaryRestriction`.
 */
export type DietaryRestriction = 'vegetarian' | 'vegan' | 'no-seafood';
export type Weather = 'sunny' | 'rainy';
export type RouteMode = 'hub-budget' | 'quiz-vibe';

// ── Places (Google Places + IBB shaped) ────────────────────────────
export interface Place {
  placeId: string;
  name: string;
  hub: Hub;
  lat: number;
  lng: number;
  /**
   * Curated editorial score. `null` means **not yet rated** — never render a
   * star for it. Two thirds of the catalogue is unrated, and showing them all
   * the same placeholder number would put a judgement nobody made in front of
   * a traveller.
   */
  rating: number | null;
  reviewCount: number;
  category: Interest;
  interests: Interest[];
  entryFeeTry: number;
  /** Ticket price is an unverified estimate — render it as "~₺600". Free (0) is never flagged. */
  entryFeeApprox?: boolean;
  avgFoodCostTry: number;
  avgVisitMinutes: number;
  openingHours: string;
  /**
   * Where `openingHours` came from, when it was not curated by hand.
   * `'OpenStreetMap'` carries an ODbL attribution obligation — any surface
   * that shows these hours has to credit OSM, so this field is load-bearing
   * rather than informational.
   */
  openingHoursSource?: 'OpenStreetMap';
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
  /**
   * Provenance label — 'Curated (estimated)' or 'IBB Open Data'.
   * ⚠️ Only ever name a provider the data really came from; see the backend's
   * `place.ts` for why thirty-three records stopped claiming 'Google Places'.
   */
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

/**
 * What the traveller asked for on a given day. Lives here rather than beside
 * the form that edits it, because the persisted plan is built out of it and a
 * type owned by a component would make `types.ts` depend on the UI.
 */
export interface RouteConfig {
  hub: Hub;
  budgetTry: number;
  paceHours: number;
  group: GroupType;
  interests: Interest[];
  weather: Weather;
  startHour: number;
}

/**
 * One day of the working plan, as stored on the server.
 *
 * `placeIds` is the edit and `itinerary` is a cache of it. The order is what a
 * drag actually produces and what the next rebuild replays; the itinerary is
 * kept alongside so reopening the dashboard paints the plan immediately rather
 * than firing one rebuild per day and showing spinners for a plan that has not
 * changed. If the two ever disagree, `placeIds` wins — it is the intent.
 *
 * Deliberately excludes `undoStack`, `loading` and `error`: undo is scoped to
 * a sitting, and the other two describe a request, not a plan.
 */
export interface PersistedDay {
  config: RouteConfig;
  mustVisitIds: string[];
  reservations: Reservation[];
  placeIds: string[];
  itinerary: Itinerary | null;
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
  /**
   * CC BY-SA requires the licence to be named and linked next to the credit,
   * not just the source. Optional on the type so a response cached by an older
   * backend still renders — the panel drops the licence line rather than
   * printing "undefined" beside a credit.
   */
  licence?: string;
  licenceUrl?: string;
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

/**
 * A warning or note about the shape of the day, sent as a code because the
 * backend does not know which language the reader picked. `t()` turns it into
 * a sentence; `places` fills the blank in it.
 */
export type ItineraryNoticeCode =
  | 'adalar-separate-day'
  | 'adalar-last-ferry'
  | 'adalar-return-ferry'
  | 'cross-side-day'
  | 'closed-that-day'
  | 'opens-too-late';

export interface ItineraryNotice {
  code: ItineraryNoticeCode;
  severity: 'info' | 'warning';
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
  /** Optional so an itinerary cached before this field existed still renders. */
  notices?: ItineraryNotice[];
  generatedAt: string;
}

/**
 * Someone this account has a connection with, in one of three states.
 *
 * `pending-in` is a request waiting on you; `pending-out` is one you are
 * waiting on. Only `accepted` can be messaged, and the server enforces that
 * regardless of what this says.
 */
export interface MessagingConnection {
  userId: string;
  name: string;
  status: 'pending-in' | 'pending-out' | 'accepted';
  /**
   * Self-declared, and sent only to callers who are in women-traveler mode
   * themselves — the same reciprocity rule the buddy list applies.
   *
   * ⚠️ Never verified. The SOS panel narrows on it and says so.
   */
  identifiesAsWoman?: boolean;
}

export interface DirectMessage {
  id: string;
  senderId: string;
  recipientId: string;
  body: string;
  createdAt: string;
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
  walkingTolerance?: WalkingTolerance;
  visitedBefore?: boolean;
  quiz?: {
    mood: 'history' | 'foodie' | 'art' | 'photo';
    pace: 'relaxed' | 'moderate' | 'packed';
    budgetTry: number;
    party?: GroupType;
    walkingTolerance?: WalkingTolerance;
    visitedBefore?: boolean;
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

/**
 * `POST /itinerary/optimize` — reorder a day to spend less of it travelling.
 *
 * `weekday` is sent because opening hours are a per-day fact ("closed Mon")
 * and only the client knows which day the traveller is planning for.
 */
export interface OptimizeRouteRequest extends RebuildRouteRequest {
  /** 0 = Monday, matching how opening hours are written. */
  weekday?: number;
}

export interface OptimizeSummary {
  order: string[];
  /** Transit minutes only — visit durations are the same in any order. */
  beforeMinutes: number;
  afterMinutes: number;
  /** Zero means the day was already efficient and nothing was changed. */
  movedStops: number;
  /**
   * How many stops had opening hours that could actually be checked. Most of
   * the catalogue records none, so this is what stops the UI from claiming a
   * guarantee about stops nobody has hours for.
   */
  constrainedStops: number;
  /** Stops held in place by a booking. */
  pinnedStops: number;
}

export interface OptimizeRouteResult {
  /** The day as it was — what undo restores. */
  before: Itinerary;
  /** The suggested day. Identical to `before` when nothing improved. */
  after: Itinerary;
  summary: OptimizeSummary;
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

/**
 * A curated demo profile.
 *
 * ⚠️ Nobody is behind these. They are shown for texture and are never an
 * action target — no connect, no message, no compatibility score. `isSample`
 * comes from the server rather than being inferred from the id shape; see the
 * backend's `check-in.ts` for why.
 */
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
  /** Always `true` here. Present so the two lists read the same way. */
  isSample?: true;
}

/**
 * A real account in the buddy list — the only kind that can be connected to.
 *
 * Almost everything is nullable, and deliberately so: this is whatever its
 * owner chose to fill in, not a fixture written to look complete. The UI omits
 * a line rather than printing a placeholder for it.
 */
export interface RealTraveler {
  id: string;
  name: string;
  age: number | null;
  nationality: string | null;
  avatarColor: string;
  tags: TravelTag[];
  bio: string | null;
  preferredHubs: Hub[];
  budgetLevel: BudgetLevel | null;
  /** ⚠️ Self-declared, NOT verified. Redacted for viewers who have not opted in. */
  identifiesAsWoman?: boolean;
  matchScore?: number | null;
  sharedStyles?: TravelTag[];
  isSample: false;
}

/** Coarse spending band used by buddy matching. */
export type BudgetLevel = 'budget' | 'mid' | 'comfort';

/** Response of `GET /social/travelers`. */
export interface TravelerListResult {
  /** Real accounts, ranked by `matchScore`, best first. */
  travelers: RealTraveler[];
  /**
   * The demo seed. Unranked and inert — a percentage describing how well you
   * would get along with a fixture is a number about nothing.
   */
  sampleTravelers: Traveler[];
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
  /**
   * True when this came from the offline fallback rather than the server.
   *
   * Without it the fallback's empty `travelers` array is indistinguishable
   * from the server genuinely reporting nobody, and the page rendered the
   * first as the second: "nobody else has signed up yet" shown to someone
   * whose request never left the device. The sample profiles still come back —
   * they are local fixtures and need no network — so this flag is what lets
   * the page show them while admitting it does not know about real accounts.
   */
  offline?: boolean;
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
  /**
   * `isSample` is the server's answer to "is there an account behind this
   * name". Nothing may be offered against a sample author — the connect
   * request would be refused, and asking anyway shows a dead button.
   */
  traveler: Pick<Traveler, 'id' | 'name' | 'avatarColor'> & { isSample: boolean };
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
  /**
   * `true` for every route today — the author names have no accounts behind
   * them and the baseline like count is invented. Stated by the server, same
   * flag and same meaning as on travellers and forum posts, so the UI labels
   * what the data says rather than what someone remembered.
   */
  isSample: boolean;
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
  /**
   * Per-answer, not per-thread: a seed question collects real answers over
   * time, so one thread holds both kinds and only the fixture ones get marked.
   */
  isSample: boolean;
}

export interface ForumQuestion {
  id: string;
  authorName: string;
  question: string;
  createdAt: string;
  /** `true` for every question today — all of them are seed. */
  isSample: boolean;
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

// (`Tour` and `TourSource` lived here. They described a local list of invented
// activities badged as GetYourGuide's and TripAdvisor's. The /tours page keeps
// its three real referrals in `data/tours.ts` and needs neither type.)


// ── AI assistant ───────────────────────────────────────────────────
export interface AiSuggestion {
  placeId: string;
  name: string;
  reason: string;
  costTry: number;
  safety: 'safe' | 'caution';
}


// ── Trip expenses ──────────────────────────────────────────────────
//
// ⚠️ A record, not a payment rail. Pathwise computes who owes whom and stops
// there: it holds no funds, moves no money and stores no payment credential.
// Same call as the tours page, which links out rather than selling a ticket.

export type ExpenseCategory =
  | 'food'
  | 'tickets'
  | 'transport'
  | 'shopping'
  | 'other';

export type ExpenseCurrency = 'TRY' | 'USD' | 'EUR' | 'GBP';

export interface Expense {
  id: string;
  dayIndex: number;
  category: ExpenseCategory;
  placeId: string | null;
  placeName: string | null;
  note: string | null;
  amountTry: number;
  /** What was typed, in the currency it was typed in. */
  enteredAmount: number;
  enteredCurrency: ExpenseCurrency;
  /** Lira per unit of `enteredCurrency` at the time. Null when already lira. */
  rateToTry: number | null;
  /** 'live' | 'cache' | 'fallback' | 'none' — the UI labels a non-live rate. */
  rateSource: string;
  paidByUserId: string;
  /** Empty means personal: counted in the budget, owed by nobody. */
  participantIds: string[];
  createdAt: string;
}

/** One line of "who owes whom" — to be settled between the people, not here. */
export interface Debt {
  fromId: string;
  toId: string;
  amountTry: number;
}

export interface ExpenseLedger {
  expenses: Expense[];
  spentByDayTry: Record<number, number>;
  totalTry: number;
  byCategoryTry: Record<string, number>;
  debts: Debt[];
  names: Record<string, string>;
  /** Always true. The server states it so this screen cannot omit it. */
  settlementIsRecordOnly: true;
}

export interface CreateExpenseRequest {
  dayIndex: number;
  category: ExpenseCategory;
  amount: number;
  currency: ExpenseCurrency;
  placeId?: string;
  placeName?: string;
  note?: string;
  paidByUserId?: string;
  participantIds?: string[];
}
