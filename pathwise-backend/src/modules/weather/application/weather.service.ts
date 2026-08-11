import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MemoryStoreService } from '../../../infrastructure/cache/memory-store.service';

export type CrowdLevel = 'Low' | 'Moderate' | 'High';

/**
 * Shape the weather widget consumes. Extends the original mock shape (city,
 * tempC, condition, icon, crowdLevel) with the live fields OpenWeatherMap gives
 * us. `crowdLevel` stays a HEURISTIC — there is no real crowd feed — derived
 * from the local hour and conditions.
 */
export interface WeatherCrowd {
  city: string;
  tempC: number;
  feelsLikeC: number;
  humidityPct: number;
  condition: string;
  conditionCode: number;
  icon: string;
  crowdLevel: CrowdLevel;
  source: 'live' | 'cache' | 'fallback';
}

// Istanbul (Sultanahmet). Current Weather Data endpoint — free tier, key req'd.
const ISTANBUL = { lat: 41.0082, lng: 28.9784 };
const CACHE_KEY = 'weather:istanbul';
const CACHE_TTL_SECONDS = 15 * 60; // 15 minutes

/** Mirrors the frontend's original mock so behaviour is unchanged without a key. */
const FALLBACK: Omit<WeatherCrowd, 'source' | 'crowdLevel'> = {
  city: 'Istanbul',
  tempC: 26,
  feelsLikeC: 26,
  humidityPct: 50,
  condition: 'Sunny',
  conditionCode: 800,
  icon: '☀️',
};

interface OwmResponse {
  weather?: { id: number; main: string; description: string }[];
  main?: { temp: number; feels_like: number; humidity: number };
}

@Injectable()
export class WeatherService {
  private readonly logger = new Logger(WeatherService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly store: MemoryStoreService,
  ) {}

  /**
   * Current Istanbul weather + a heuristic crowd level, cached for 15 minutes.
   * If the key is missing or any call fails, degrades silently to the mock —
   * the widget must never break and the feed is never load-bearing.
   */
  async getCurrent(): Promise<WeatherCrowd> {
    try {
      const cached = await this.store.get(CACHE_KEY);
      if (cached) return { ...(JSON.parse(cached) as WeatherCrowd), source: 'cache' };
    } catch (err) {
      this.logger.warn(`Cache read failed, fetching fresh weather: ${String(err)}`);
    }

    const key = this.config.get<string>('OPENWEATHER_API_KEY');
    if (!key) {
      this.logger.warn('OPENWEATHER_API_KEY not set — using fallback weather');
      return { ...FALLBACK, crowdLevel: this.estimateCrowd(FALLBACK.conditionCode), source: 'fallback' };
    }

    try {
      const url =
        `https://api.openweathermap.org/data/2.5/weather` +
        `?lat=${ISTANBUL.lat}&lon=${ISTANBUL.lng}&units=metric&appid=${key}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (!res.ok) throw new Error(`OpenWeather responded ${res.status}`);
      const body = (await res.json()) as OwmResponse;

      const w = body.weather?.[0];
      const m = body.main;
      if (!w || !m) throw new Error('Malformed OpenWeather payload');

      const payload: WeatherCrowd = {
        city: 'Istanbul',
        tempC: Math.round(m.temp),
        feelsLikeC: Math.round(m.feels_like),
        humidityPct: m.humidity,
        condition: capitalize(w.description),
        conditionCode: w.id,
        icon: iconFor(w.id),
        crowdLevel: this.estimateCrowd(w.id),
        source: 'live',
      };

      try {
        await this.store.setWithTtl(CACHE_KEY, JSON.stringify(payload), CACHE_TTL_SECONDS);
      } catch (err) {
        this.logger.warn(`Cache write failed (weather still served): ${String(err)}`);
      }
      return payload;
    } catch (err) {
      this.logger.warn(`OpenWeather fetch failed, using fallback: ${String(err)}`);
      return { ...FALLBACK, crowdLevel: this.estimateCrowd(FALLBACK.conditionCode), source: 'fallback' };
    }
  }

  /**
   * Heuristic crowd estimate (NO real crowd API): busiest midday, quieter at
   * the edges of the day, and knocked down a level when the weather is bad.
   * Uses Istanbul local time (UTC+3).
   */
  private estimateCrowd(conditionCode: number): CrowdLevel {
    const istanbulHour = (new Date().getUTCHours() + 3) % 24;
    let level: CrowdLevel =
      istanbulHour >= 11 && istanbulHour < 17
        ? 'High'
        : istanbulHour >= 9 && istanbulHour < 20
          ? 'Moderate'
          : 'Low';
    // Rain/thunder/snow (2xx/5xx/6xx) thins the crowds by one level.
    const bad = conditionCode < 700 && conditionCode >= 200;
    if (bad) level = level === 'High' ? 'Moderate' : 'Low';
    return level;
  }
}

function capitalize(s: string): string {
  return s.length ? s[0].toUpperCase() + s.slice(1) : s;
}

/** Map an OpenWeather condition code to a weather emoji. */
function iconFor(code: number): string {
  if (code >= 200 && code < 300) return '⛈️';
  if (code >= 300 && code < 400) return '🌦️';
  if (code >= 500 && code < 600) return '🌧️';
  if (code >= 600 && code < 700) return '🌨️';
  if (code >= 700 && code < 800) return '🌫️';
  if (code === 800) return '☀️';
  if (code > 800) return '⛅';
  return '🌡️';
}
