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
  Itinerary,
  PastTrip,
  Place,
  ProfileStats,
  Tour,
  Traveler,
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
const ACCESS_KEY = 'pathwise.access';
const REFRESH_KEY = 'pathwise.refresh';

export const tokenStore = {
  get access() {
    return localStorage.getItem(ACCESS_KEY);
  },
  get refresh() {
    return localStorage.getItem(REFRESH_KEY);
  },
  set(access: string, refresh: string) {
    localStorage.setItem(ACCESS_KEY, access);
    localStorage.setItem(REFRESH_KEY, refresh);
  },
  clear() {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
  },
};

/** Endpoints that must never trigger the refresh-retry loop. */
const AUTH_PATHS = ['/auth/login', '/auth/register', '/auth/refresh'];

/** Shared in-flight refresh so concurrent 401s trigger a single rotation. */
let refreshPromise: Promise<boolean> | null = null;

async function tryRefresh(): Promise<boolean> {
  if (!tokenStore.refresh) return false;
  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const res = await fetch(`${API_URL}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken: tokenStore.refresh }),
        });
        if (!res.ok) throw new Error('refresh failed');
        const data = (await res.json()) as { accessToken: string; refreshToken: string };
        tokenStore.set(data.accessToken, data.refreshToken);
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
  return fetch(`${API_URL}${path}`, { ...options, headers });
}

async function http<T>(path: string, options: RequestInit = {}): Promise<T> {
  let res = await rawFetch(path, options);

  // Access token likely expired → rotate once via the refresh token and retry.
  if (res.status === 401 && !AUTH_PATHS.includes(path) && tokenStore.refresh) {
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
    tokenStore.set(res.accessToken, res.refreshToken);
    return res;
  },

  async login(input: { email: string; password: string }): Promise<AuthResponse> {
    const res = await http<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    tokenStore.set(res.accessToken, res.refreshToken);
    return res;
  },

  async me(): Promise<AuthUser> {
    return http<AuthUser>('/users/me');
  },

  async logout(): Promise<void> {
    const refreshToken = tokenStore.refresh;
    try {
      if (refreshToken) {
        await http<void>('/auth/logout', {
          method: 'POST',
          body: JSON.stringify({ refreshToken }),
        });
      }
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
