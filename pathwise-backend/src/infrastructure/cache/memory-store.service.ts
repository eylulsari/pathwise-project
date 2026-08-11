import { Injectable } from '@nestjs/common';

/**
 * In-process key/value store with TTLs — the caches and quota counters that
 * used to live in Redis.
 *
 * ⚠️ **SINGLE-INSTANCE BY DESIGN.** State lives in this process, so:
 *  - it is lost on restart (caches re-fetch, quotas reset in the user's
 *    favour — no correctness problem, and every cached call already has a
 *    fallback path);
 *  - with more than one instance each would keep its OWN cache and its OWN
 *    quota counters, so a per-hour limit of N would effectively become N per
 *    instance.
 *
 * That is an accepted, documented trade for dropping a managed Redis on the
 * free hosting tier — not hidden debt. **The moment this scales past one
 * instance, the quota counters need a shared store again** (the caches would
 * merely be less efficient, which is survivable; the quotas would be wrong).
 * The API below is deliberately the same narrow surface the Redis facade had,
 * so that swap stays a one-file change.
 *
 * Refresh tokens deliberately do NOT live here — they are real state and went
 * to Postgres, where they now survive a restart (Redis did not guarantee that
 * either).
 */
interface Entry {
  value: string;
  /** Epoch ms. */
  expiresAt: number;
}

@Injectable()
export class MemoryStoreService {
  private readonly store = new Map<string, Entry>();

  /**
   * Expiry is checked on read rather than swept by a timer: a timer per key
   * would keep the event loop busy for data nobody is asking for. The only
   * cost is that untouched expired keys hold memory until someone looks —
   * bounded here by a sweep on write.
   */
  private isLive(entry: Entry | undefined, now: number): entry is Entry {
    return !!entry && entry.expiresAt > now;
  }

  /** Drop everything already expired. Cheap: these maps hold tens of keys. */
  private sweep(now: number): void {
    for (const [key, entry] of this.store) {
      if (entry.expiresAt <= now) this.store.delete(key);
    }
  }

  async setWithTtl(key: string, value: string, ttlSeconds: number): Promise<void> {
    const now = Date.now();
    this.sweep(now);
    this.store.set(key, { value, expiresAt: now + ttlSeconds * 1000 });
  }

  async get(key: string): Promise<string | null> {
    const entry = this.store.get(key);
    if (!this.isLive(entry, Date.now())) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  async del(key: string): Promise<void> {
    this.store.delete(key);
  }

  async exists(key: string): Promise<boolean> {
    return (await this.get(key)) !== null;
  }

  /**
   * Increment a counter, setting the TTL when it is first created.
   *
   * Matches the Redis semantics it replaces: the TTL is applied on creation
   * only, so a counter expires a fixed window after it started rather than
   * being extended by every hit — which is what makes it a usable rate limit.
   */
  async increment(key: string, ttlSeconds: number): Promise<number> {
    const now = Date.now();
    const entry = this.store.get(key);
    if (!this.isLive(entry, now)) {
      this.store.set(key, { value: '1', expiresAt: now + ttlSeconds * 1000 });
      return 1;
    }
    const next = Number(entry.value) + 1;
    // Keep the original expiry — do not slide the window.
    entry.value = String(next);
    return next;
  }

  async getCount(key: string): Promise<number> {
    const raw = await this.get(key);
    return raw ? Number(raw) : 0;
  }
}
