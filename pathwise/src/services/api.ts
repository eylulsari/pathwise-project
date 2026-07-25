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
  NearbySuggestion,
  PastTrip,
  Place,
  ProfileStats,
  SavedTrip,
  Tour,
  Traveler,
  UsageInfo,
} from '../types';
import { PLACES, PLACES_BY_ID } from '../hubData';
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
  return res.json() as Promise<T>;
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
  /** Full audio guide — premium only (throws on 402 for free users). */
  async getFullAudioGuide(placeId: string): Promise<{ durationSeconds: number; transcript: string }> {
    return http(`/premium/audio-guide/${placeId}`);
  },

  // ═════════════════════════════════════════════════════════════════
  // MODERATION — report social content (B7).
  // ═════════════════════════════════════════════════════════════════
  async reportContent(
    contentType: 'forum' | 'checkin' | 'route',
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
  async getCheckIns(): Promise<CheckIn[]> {
    return delay(CHECK_INS);
  },
  async getTravelers(): Promise<Traveler[]> {
    return delay(TRAVELERS);
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
  async getBadges(): Promise<Badge[]> {
    return delay(BADGES);
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
  // WEATHER — OpenWeatherMap current-conditions
  //   return http(`https://api.openweathermap.org/data/2.5/weather?q=Istanbul...`);
  // ═════════════════════════════════════════════════════════════════
  async getWeather() {
    return delay(CURRENT_WEATHER, 200);
  },

  // ═════════════════════════════════════════════════════════════════
  // AI ASSISTANT — would call the backend which proxies an LLM. Here a
  // deterministic mock keyed off the question keywords.
  // ═════════════════════════════════════════════════════════════════
  async askAssistant(question: string): Promise<{
    answer: string;
    suggestion?: AiSuggestion;
  }> {
    const q = question.toLowerCase();
    let suggestion: AiSuggestion | undefined;
    let answer =
      'I can help you plan around budget, weather and vibe. Try asking for a sunset spot, a cheap eat, or a rainy-day plan.';

    if (q.includes('sunset') || q.includes('golden')) {
      suggestion = {
        placeId: 'ChIJ-galata-tower',
        name: 'Galata Tower',
        reason: 'Best 360° golden-hour view over the Golden Horn.',
        costTry: 1000,
        safety: 'safe',
      };
      answer = 'For golden hour, head to Galata Tower ~45 min before sunset.';
    } else if (q.includes('cheap') || q.includes('budget') || q.includes('eat')) {
      suggestion = {
        placeId: 'ChIJ-kadikoy-carsi',
        name: 'Kadıköy Market',
        reason: 'Graze fish sandwiches, pickles and börek for very little.',
        costTry: 250,
        safety: 'safe',
      };
      answer = 'On a budget? Graze your way through Kadıköy Market on the Asian side.';
    } else if (q.includes('rain')) {
      suggestion = {
        placeId: 'ChIJ-sultanahmet-basilicacistern',
        name: 'Basilica Cistern',
        reason: 'Fully underground — perfect when it rains.',
        costTry: 900,
        safety: 'safe',
      };
      answer = 'Raining? Duck into the Basilica Cistern — it is entirely indoors.';
    }
    return delay({ answer, suggestion }, 600);
  },
};
