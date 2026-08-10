/**
 * Central data layer. Every data access in the app goes through here.
 *
 * - Auth + itinerary + places call the real Pathwise backend over HTTP.
 * - Social / profile / tours / weather are served from the mock modules with a
 *   simulated network delay; each function documents the real endpoint it would
 *   hit (Firebase/Postgres, GetYourGuide, OpenWeatherMap) in a comment so the
 *   swap to live data is a one-function change.
 */
import type {
  AiSuggestion,
  AuthResponse,
  AuthUser,
  Badge,
  CheckIn,
  CommunityRoute,
  ForumQuestion,
  GenerateRouteRequest,
  RebuildRouteRequest,
  Hub,
  Itinerary,
  JournalEntry,
  JournalSummary,
  NearbySuggestion,
  PastTrip,
  Place,
  PlaceEnrichment,
  PointsAward,
  PointsSummary,
  ProfileStats,
  SavedTrip,
  Tour,
  TravelerListResult,
  TravelTag,
  UsageInfo,
} from '../types';
import { PLACES, PLACES_BY_ID } from '../hubData';
import { withEarnedBadges } from '../utils/badgeStore';
import {
  BADGES,
  CHECK_INS,
  COMMUNITY_ROUTES,
  CURATED_TOURS,
  CURRENT_WEATHER,
  FORUM_QUESTIONS,
  LIVE_TOURS,
  PAST_TRIPS,
  PROFILE_STATS,
  TRAVELERS,
} from '../mockData';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api';

/** Simulated network latency for the mock endpoints. */
const delay = <T>(data: T, ms = 350): Promise<T> =>
  new Promise((resolve) => setTimeout(() => resolve(data), ms));

// ── token storage ──────────────────────────────────────────────────
// Only the short-lived access token is kept in JS. The refresh token lives in
// an httpOnly cookie the browser attaches automatically (safe from XSS).
const ACCESS_KEY = 'pathwise.access';

export const tokenStore = {
  get access() {
    return localStorage.getItem(ACCESS_KEY);
  },
  setAccess(access: string) {
    localStorage.setItem(ACCESS_KEY, access);
  },
  clear() {
    localStorage.removeItem(ACCESS_KEY);
  },
};

/** Endpoints that must never trigger the refresh-retry loop. */
const AUTH_PATHS = ['/auth/login', '/auth/register', '/auth/refresh'];

/** Shared in-flight refresh so concurrent 401s trigger a single rotation. */
let refreshPromise: Promise<boolean> | null = null;

async function tryRefresh(): Promise<boolean> {
  if (!tokenStore.access) return false; // no prior session to refresh
  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        // The refresh token rides along as an httpOnly cookie (credentials).
        const res = await fetch(`${API_URL}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
        });
        if (!res.ok) throw new Error('refresh failed');
        const data = (await res.json()) as { accessToken: string };
        tokenStore.setAccess(data.accessToken);
        return true;
      } catch {
        tokenStore.clear();
        return false;
      } finally {
        refreshPromise = null;
      }
    })();
  }
  return refreshPromise;
}

async function rawFetch(path: string, options: RequestInit): Promise<Response> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (tokenStore.access) headers.Authorization = `Bearer ${tokenStore.access}`;
  // Always include credentials so the httpOnly refresh cookie is set/sent.
  return fetch(`${API_URL}${path}`, { ...options, headers, credentials: 'include' });
}

async function http<T>(path: string, options: RequestInit = {}): Promise<T> {
  let res = await rawFetch(path, options);

  // Access token likely expired → rotate once via the refresh cookie and retry.
  if (res.status === 401 && !AUTH_PATHS.includes(path) && tokenStore.access) {
    const refreshed = await tryRefresh();
    if (refreshed) res = await rawFetch(path, options);
  }

  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      message = Array.isArray(body.message)
        ? body.message.join(', ')
        : body.message ?? message;
    } catch {
      /* non-JSON error body */
    }
    throw new Error(message);
  }
  if (res.status === 204) return undefined as T;
  // Some endpoints legitimately answer 200 with no body (e.g. suggest-nearby
  // when there is nothing to suggest — Nest serialises `undefined` as empty).
  // `res.json()` throws on that, so parse defensively instead.
  const text = await res.text();
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}

// ═══════════════════════════════════════════════════════════════════
// AUTH — real backend (NestJS + PostgreSQL + Redis)
// ═══════════════════════════════════════════════════════════════════
export const api = {
  async register(input: {
    name: string;
    email: string;
    password: string;
    nationality?: string;
    age?: number;
  }): Promise<AuthResponse> {
    const res = await http<AuthResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    tokenStore.setAccess(res.accessToken);
    return res;
  },

  async login(input: { email: string; password: string }): Promise<AuthResponse> {
    const res = await http<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    tokenStore.setAccess(res.accessToken);
    return res;
  },

  async me(): Promise<AuthUser> {
    return http<AuthUser>('/users/me');
  },

  /**
   * Opt-in women-traveler preferences. Send only the keys that changed —
   * omitted preferences are left untouched server-side.
   */
  async updateSafetyPreferences(
    input: import('../types').SafetyPreferencesInput,
  ): Promise<AuthUser> {
    return http<AuthUser>('/users/me/safety-preferences', {
      method: 'PATCH',
      body: JSON.stringify(input),
    });
  },

  // ═════════════════════════════════════════════════════════════════
  // PREMIUM — feature-flag tier (demo; real payment is a TODO).
  // ═════════════════════════════════════════════════════════════════
  async setSubscription(tier: 'free' | 'premium'): Promise<AuthUser> {
    return http<AuthUser>('/premium/subscription', {
      method: 'POST',
      body: JSON.stringify({ tier }),
    });
  },
  async getUsage(): Promise<UsageInfo> {
    return http<UsageInfo>('/premium/usage');
  },
  /** A6 — record a client-side paywall hit (day/story/pdf). */
  async recordPaywall(feature: 'day' | 'story' | 'pdf'): Promise<void> {
    await http('/analytics/paywall', { method: 'POST', body: JSON.stringify({ feature }) }).catch(() => {});
  },
  /**
   * A7 — record an affiliate/partner link click, which is also the "Reserve"
   * action that earns reward points. Returns the award so the caller can toast
   * the exact figure the server credited; `null` if the call failed, in which
   * case the booking link still opens (the reward is a bonus, not a gate).
   */
  async recordAffiliateClick(tourId: string, source: string): Promise<PointsAward | null> {
    return http<PointsAward>('/analytics/affiliate-click', {
      method: 'POST',
      body: JSON.stringify({ tourId, source }),
    }).catch(() => null);
  },

  // ═════════════════════════════════════════════════════════════════
  // REWARD POINTS — accrual + visibility (no catalogue/spending yet).
  // ═════════════════════════════════════════════════════════════════
  async getPoints(): Promise<PointsSummary> {
    return http<PointsSummary>('/points/me');
  },
  /**
   * Finished every stop on the day's route. The server throttles this to once
   * per day and answers `awarded: 0` (not an error) when it declines, so the
   * caller just skips the toast.
   */
  async awardRouteCompletion(): Promise<PointsAward | null> {
    return http<PointsAward>('/points/route-completed', { method: 'POST' }).catch(() => null);
  },

  // ── SOS / safety (Phase 2) ──
  async sendSosAlert(input: { lat: number; lng: number; share: boolean; sharedWithUserIds: string[] }): Promise<{ sharedCount: number }> {
    return http('/safety/sos-alert', { method: 'POST', body: JSON.stringify(input) });
  },

  // ── Notification Center (B6) ──
  async getNotifications(): Promise<import('../types').AppNotification[]> {
    return http('/notifications');
  },
  async getUnreadCount(): Promise<number> {
    const r = await http<{ count: number }>('/notifications/unread-count');
    return r.count;
  },
  async markNotificationRead(id: string): Promise<void> {
    await http(`/notifications/${id}/read`, { method: 'POST' });
  },
  async markAllNotificationsRead(): Promise<void> {
    await http('/notifications/read-all', { method: 'POST' });
  },
  async getNotifPrefs(): Promise<string[]> {
    const r = await http<{ muted: string[] }>('/notifications/preferences');
    return r.muted;
  },
  async setNotifPrefs(muted: string[]): Promise<void> {
    await http('/notifications/preferences', { method: 'PUT', body: JSON.stringify({ muted }) });
  },
  async emitNotification(type: 'budget' | 'nearby'): Promise<void> {
    await http('/notifications/emit', { method: 'POST', body: JSON.stringify({ type }) }).catch(() => {});
    // Nudge the notification bell to refresh its unread count.
    window.dispatchEvent(new Event('pw-notify'));
  },

  // ── Group Poll (B3) ──
  async createPoll(question: string, options: { placeId: string; label: string }[]): Promise<import('../types').Poll> {
    return http('/polls', { method: 'POST', body: JSON.stringify({ question, options }) });
  },
  async getPolls(): Promise<import('../types').Poll[]> {
    return http('/polls');
  },
  async votePoll(id: string, optionId: string): Promise<import('../types').Poll> {
    return http(`/polls/${id}/vote`, { method: 'POST', body: JSON.stringify({ optionId }) });
  },
  async closePoll(id: string): Promise<import('../types').Poll> {
    return http(`/polls/${id}/close`, { method: 'POST' });
  },

  // ── Referral (B2) ──
  async getReferral(): Promise<{ code: string; redeemedCount: number; rewardDays: number }> {
    return http('/referral/me');
  },
  async redeemReferral(code: string): Promise<{ rewardedDays: number }> {
    return http('/referral/redeem', { method: 'POST', body: JSON.stringify({ code }) });
  },
  /** Full audio guide — premium only (throws on 402 for free users). */
  async getFullAudioGuide(placeId: string): Promise<{ durationSeconds: number; transcript: string }> {
    return http(`/premium/audio-guide/${placeId}`);
  },

  // ═════════════════════════════════════════════════════════════════
  // MODERATION — report social content (B7).
  // ═════════════════════════════════════════════════════════════════
  async reportContent(
    contentType: 'forum' | 'checkin' | 'route' | 'stale_info',
    contentId: string,
    reason: string,
  ): Promise<void> {
    await http('/moderation/reports', {
      method: 'POST',
      body: JSON.stringify({ contentType, contentId, reason }),
    });
  },

  async logout(): Promise<void> {
    try {
      // Server reads the refresh cookie, revokes it and clears it.
      await http<void>('/auth/logout', { method: 'POST' });
    } catch {
      /* already signed out / token expired */
    } finally {
      tokenStore.clear();
    }
  },

  // ═════════════════════════════════════════════════════════════════
  // ITINERARY — real backend (strategy + factory engine)
  // ═════════════════════════════════════════════════════════════════
  async generateRoute(req: GenerateRouteRequest): Promise<Itinerary> {
    return http<Itinerary>('/itinerary/generate', {
      method: 'POST',
      body: JSON.stringify(req),
    });
  },

  /** Recompute after a manual drag-and-drop reorder (keeps the given order). */
  async rebuildRoute(req: RebuildRouteRequest): Promise<Itinerary> {
    return http<Itinerary>('/itinerary/rebuild', {
      method: 'POST',
      body: JSON.stringify(req),
    });
  },

  // ═════════════════════════════════════════════════════════════════
  // TRIP JOURNAL (B1) — photo/note/rating per visited place.
  // ═════════════════════════════════════════════════════════════════
  async upsertJournal(input: {
    placeId: string;
    rating: number;
    photoUrl?: string;
    note?: string;
  }): Promise<JournalEntry> {
    return http<JournalEntry>('/journal', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },
  async getJournal(): Promise<JournalEntry[]> {
    return http<JournalEntry[]>('/journal');
  },
  async getJournalSummary(): Promise<JournalSummary> {
    return http<JournalSummary>('/journal/summary');
  },

  /** "Add this too" — one nearby unselected place in the same hub. */
  async suggestNearby(hub: Hub, placeIds: string[]): Promise<NearbySuggestion | null> {
    return http<NearbySuggestion | null>('/itinerary/suggest-nearby', {
      method: 'POST',
      body: JSON.stringify({ hub, placeIds }),
    });
  },

  // ═════════════════════════════════════════════════════════════════
  // TRIPS — real backend (Postgres). Save/list/delete a user's plans.
  // ═════════════════════════════════════════════════════════════════
  async saveTrip(title: string, itinerary: Itinerary): Promise<SavedTrip> {
    return http<SavedTrip>('/trips', {
      method: 'POST',
      body: JSON.stringify({ title, itinerary }),
    });
  },
  async getTrips(): Promise<SavedTrip[]> {
    return http<SavedTrip[]>('/trips');
  },
  async deleteTrip(id: string): Promise<void> {
    return http<void>(`/trips/${id}`, { method: 'DELETE' });
  },

  // ═════════════════════════════════════════════════════════════════
  // PLACES — Google Places shaped. Served locally so the map works
  // offline; production would call the backend which proxies Google.
  //   return http<Place[]>(`/places${hub ? `?hub=${hub}` : ''}`);
  // ═════════════════════════════════════════════════════════════════
  async getPlaces(hub?: string): Promise<Place[]> {
    const data = hub ? PLACES.filter((p) => p.hub === hub) : PLACES;
    return delay(data, 200);
  },

  getPlaceById(id: string): Place | undefined {
    return PLACES_BY_ID[id];
  },

  /** Free-text place search (backend substring search). */
  async searchPlaces(q: string): Promise<Place[]> {
    if (!q.trim()) return [];
    return http<Place[]>(`/places/search?q=${encodeURIComponent(q)}`);
  },

  // ── Reviews (Phase 3) ──
  async getReviews(placeId: string): Promise<import('../types').ReviewsResponse> {
    return http(`/places/${placeId}/reviews`);
  },
  async createReview(placeId: string, rating: number, comment: string): Promise<import('../types').ReviewsResponse> {
    return http(`/places/${placeId}/reviews`, { method: 'POST', body: JSON.stringify({ rating, comment }) });
  },
  async markReviewHelpful(placeId: string, reviewId: string): Promise<{ id: string; helpfulCount: number }> {
    return http(`/places/${placeId}/reviews/${reviewId}/helpful`, { method: 'POST' });
  },

  // ═════════════════════════════════════════════════════════════════
  // ROUTE GEOMETRY — real OSRM foot routing so the map line follows the
  // actual streets between stops (OpenStreetMap/OSRM). Returns null on any
  // failure so the map falls back to straight lines (offline-safe).
  // ═════════════════════════════════════════════════════════════════
  async getRouteGeometry(
    stops: { lat: number; lng: number }[],
  ): Promise<[number, number][] | null> {
    if (stops.length < 2) return null;
    const coords = stops.map((s) => `${s.lng},${s.lat}`).join(';');
    const url = `https://router.project-osrm.org/route/v1/foot/${coords}?overview=full&geometries=geojson`;
    try {
      const res = await fetch(url);
      if (!res.ok) return null;
      const data = await res.json();
      const line: [number, number][] | undefined =
        data?.routes?.[0]?.geometry?.coordinates;
      if (!Array.isArray(line)) return null;
      // OSRM/GeoJSON is [lng, lat]; Leaflet wants [lat, lng].
      return line.map(([lng, lat]) => [lat, lng] as [number, number]);
    } catch {
      return null; // offline / rate-limited → caller draws straight lines
    }
  },

  // ═════════════════════════════════════════════════════════════════
  // SOCIAL — Firebase/PostgreSQL shaped (check-ins, buddies, routes, forum)
  //   return http<CheckIn[]>('/social/check-ins');
  // ═════════════════════════════════════════════════════════════════
  /**
   * The check-in feed. The mock stores "how long ago"; the real timestamp is
   * resolved here, against the clock at fetch time, so the feed is always
   * plausibly fresh and callers can reason about recency properly. A real
   * `GET /social/check-ins` would return `createdAt` directly and this
   * mapping would simply disappear.
   */
  async getCheckIns(): Promise<CheckIn[]> {
    const now = Date.now();
    const resolved = CHECK_INS.map((c) => ({
      ...c,
      createdAt: new Date(now - c.minutesAgo * 60_000).toISOString(),
    }));
    return delay(resolved);
  },
  /**
   * Traveler Buddy Finder — now a real endpoint so the opt-in women-traveler
   * filter is enforced server-side (the caller's own preferences decide what
   * they see; the query string alone is not trusted).
   *
   * `eligible` only shapes the offline fallback below — the live path derives
   * it from the authenticated user's stored profile.
   */
  async getTravelers(
    opts: { womenOnly?: boolean; eligible?: boolean } = {},
  ): Promise<TravelerListResult> {
    const qs = opts.womenOnly ? '?womenOnly=true' : '';
    try {
      return await http<TravelerListResult>(`/social/travelers${qs}`);
    } catch {
      // Offline / backend down → mirror the server rule over the local mock so
      // the page still renders. (The per-traveler `visibleToWomenOnly` opt-out
      // is a server-side concept and is not modelled in the mock dataset.)
      const womenOnlyApplied = !!opts.womenOnly && !!opts.eligible;
      const travelers = womenOnlyApplied
        ? TRAVELERS.filter((t) => t.identifiesAsWoman === true)
        : TRAVELERS;
      // Redact the declaration for viewers who have not opted in themselves.
      const visible = opts.eligible
        ? travelers
        : travelers.map((t) => {
            const copy = { ...t };
            delete copy.identifiesAsWoman;
            return copy;
          });
      return delay({ travelers: visible, womenOnlyApplied });
    }
  },
  // ── Travel styles — the vocabulary buddy matching compares on ──
  /** The pickable tags, served so the client can never offer an invalid one. */
  async getTravelStyleOptions(): Promise<TravelTag[]> {
    const r = await http<{ styles: TravelTag[] }>('/social/travel-styles');
    return r.styles;
  },
  /** Manual picker — replaces the list, the only way to REMOVE a tag. */
  async setTravelStyles(styles: TravelTag[]): Promise<TravelTag[]> {
    const r = await http<{ styles: TravelTag[] }>('/social/me/travel-styles', {
      method: 'PUT',
      body: JSON.stringify({ styles }),
    });
    return r.styles;
  },
  /**
   * Auto-fill from a completed Vibe Quiz. The server unions the derived tags
   * into what is already stored, so this never wipes a manual choice. Errors
   * are swallowed: this rides along with route generation and must not be able
   * to break it.
   */
  async applyQuizTravelStyles(quiz: {
    mood: string;
    pace: string;
    budgetTry: number;
  }): Promise<TravelTag[] | null> {
    return http<{ styles: TravelTag[] }>('/social/me/travel-styles/from-quiz', {
      method: 'POST',
      body: JSON.stringify(quiz),
    })
      .then((r) => r.styles)
      .catch(() => null);
  },

  async getCommunityRoutes(): Promise<CommunityRoute[]> {
    return delay(COMMUNITY_ROUTES);
  },
  async getForum(): Promise<ForumQuestion[]> {
    return delay(FORUM_QUESTIONS);
  },

  // ═════════════════════════════════════════════════════════════════
  // PROFILE — user aggregate tables (badges, past trips, stats)
  // ═════════════════════════════════════════════════════════════════
  /** Catalogue is mock, but badges the user actually unlocked are merged in. */
  async getBadges(): Promise<Badge[]> {
    return delay(withEarnedBadges(BADGES));
  },
  async getPastTrips(): Promise<PastTrip[]> {
    return delay(PAST_TRIPS);
  },
  async getProfileStats(): Promise<ProfileStats> {
    return delay(PROFILE_STATS);
  },

  // ═════════════════════════════════════════════════════════════════
  // TOURS — GetYourGuide / TripAdvisor partner APIs
  //   return http<Tour[]>('/tours?source=getyourguide');
  // ═════════════════════════════════════════════════════════════════
  async getCuratedTours(): Promise<Tour[]> {
    return delay(CURATED_TOURS);
  },
  /** "🔄 Sync Live Tours" — pretends to hit partner APIs (longer delay). */
  async syncLiveTours(): Promise<Tour[]> {
    return delay(LIVE_TOURS, 900);
  },

  // ═════════════════════════════════════════════════════════════════
  // WEATHER — live OpenWeatherMap via the backend (GET /weather).
  // Backend caches 15m and falls back to mock if the key/feed is missing,
  // so a failure here still degrades to the local mock shape.
  // ═════════════════════════════════════════════════════════════════
  async getWeather(): Promise<typeof CURRENT_WEATHER & {
    feelsLikeC?: number;
    humidityPct?: number;
    conditionCode?: number;
    source?: 'live' | 'cache' | 'fallback';
  }> {
    try {
      return await http('/weather');
    } catch {
      return CURRENT_WEATHER; // network down → local mock
    }
  },

  // ═════════════════════════════════════════════════════════════════
  // PLACE ENRICHMENT — live OSM (Overpass) + Wikipedia detail via backend.
  // Any missing slice is null; the UI keeps its curated values.
  // ═════════════════════════════════════════════════════════════════
  async getPlaceEnrichment(placeId: string): Promise<PlaceEnrichment> {
    return http(`/places/${encodeURIComponent(placeId)}/enrichment`);
  },

  // ═════════════════════════════════════════════════════════════════
  // CURRENCY — live TRY rates via the backend (Frankfurter, key-less).
  // Falls back to a static table server-side if the feed is unreachable.
  // ═════════════════════════════════════════════════════════════════
  async getCurrencyRates(): Promise<{
    base: 'TRY';
    date: string;
    rates: Record<string, number>;
    source: 'live' | 'cache' | 'fallback';
  }> {
    return http('/currency/rates');
  },

  // ═════════════════════════════════════════════════════════════════
  // AI ASSISTANT — real backend chat, grounded in the place dataset and
  // powered by an LLM the backend picks (Groq, else Gemini). It degrades to
  // canned answers when no key is set or the API fails, so this always
  // resolves with a usable reply; the component handles transport errors.
  // ═════════════════════════════════════════════════════════════════
  async askAssistant(
    message: string,
    conversationHistory: AiChatTurn[] = [],
    activePlan: string[] = [],
  ): Promise<{
    answer: string;
    suggestion?: AiSuggestion;
    source?: 'groq' | 'gemini' | 'fallback';
  }> {
    return http('/assistant/chat', {
      method: 'POST',
      body: JSON.stringify({ message, conversationHistory, activePlan }),
    });
  },
};

/** One turn of chat history in the backend's canonical shape. */
export interface AiChatTurn {
  role: 'user' | 'model';
  parts: { text: string }[];
}
