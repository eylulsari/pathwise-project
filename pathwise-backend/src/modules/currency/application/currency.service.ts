import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../../../infrastructure/redis/redis.service';

/** Currencies the display converter offers (base is always TRY). */
export const SUPPORTED_SYMBOLS = ['USD', 'EUR', 'GBP'] as const;
export type CurrencySymbol = (typeof SUPPORTED_SYMBOLS)[number];

export interface CurrencyRates {
  base: 'TRY';
  date: string;
  /** How much of each currency 1 TRY buys. */
  rates: Record<CurrencySymbol, number>;
  /** Where the numbers came from — useful for the UI + debugging. */
  source: 'live' | 'cache' | 'fallback';
}

/**
 * Static fallback used when Frankfurter is unreachable or the key-less call
 * fails. Mirrors the frontend's original mock rates (mid-2026) so behaviour is
 * unchanged when the network is down — the app must never depend on the feed.
 */
const FALLBACK_RATES: Record<CurrencySymbol, number> = {
  USD: 0.031,
  EUR: 0.028,
  GBP: 0.024,
};

const CACHE_KEY = 'currency:rates:TRY';
const CACHE_TTL_SECONDS = 60 * 60; // 1 hour
const FRANKFURTER_URL =
  // Frankfurter is a free, key-less ECB proxy. (Spec mentioned /v2 but the
  // live service currently serves /v1; /v2 returns 404.)
  `https://api.frankfurter.dev/v1/latest?base=TRY&symbols=${SUPPORTED_SYMBOLS.join(',')}`;

@Injectable()
export class CurrencyService {
  private readonly logger = new Logger(CurrencyService.name);

  constructor(private readonly redis: RedisService) {}

  /**
   * Live TRY exchange rates, cached in Redis for an hour. Any failure (network,
   * bad payload, Redis) degrades silently to the static fallback table so the
   * converter keeps working — this integration is never load-bearing.
   */
  async getRates(): Promise<CurrencyRates> {
    try {
      const cached = await this.redis.get(CACHE_KEY);
      if (cached) return { ...(JSON.parse(cached) as CurrencyRates), source: 'cache' };
    } catch (err) {
      this.logger.warn(`Redis read failed, fetching fresh rates: ${String(err)}`);
    }

    try {
      const res = await fetch(FRANKFURTER_URL, { signal: AbortSignal.timeout(5000) });
      if (!res.ok) throw new Error(`Frankfurter responded ${res.status}`);
      const body = (await res.json()) as { date: string; rates: Record<string, number> };

      const rates = this.pickSymbols(body.rates);
      const payload: CurrencyRates = { base: 'TRY', date: body.date, rates, source: 'live' };

      try {
        await this.redis.setWithTtl(CACHE_KEY, JSON.stringify(payload), CACHE_TTL_SECONDS);
      } catch (err) {
        this.logger.warn(`Redis write failed (rates still served): ${String(err)}`);
      }
      return payload;
    } catch (err) {
      this.logger.warn(`Frankfurter fetch failed, using fallback rates: ${String(err)}`);
      return {
        base: 'TRY',
        date: new Date().toISOString().slice(0, 10),
        rates: FALLBACK_RATES,
        source: 'fallback',
      };
    }
  }

  /** Keep only the symbols we support, filling any gap from the fallback. */
  private pickSymbols(raw: Record<string, number>): Record<CurrencySymbol, number> {
    const out = {} as Record<CurrencySymbol, number>;
    for (const sym of SUPPORTED_SYMBOLS) {
      out[sym] = typeof raw[sym] === 'number' ? raw[sym] : FALLBACK_RATES[sym];
    }
    return out;
  }
}
