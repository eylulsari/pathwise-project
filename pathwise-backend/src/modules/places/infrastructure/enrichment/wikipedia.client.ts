import { Injectable, Logger } from '@nestjs/common';
import { WikipediaEnrichment } from '../../domain/place-enrichment';

// Turkish Wikipedia REST summary endpoint (no key required).
const WIKI_SUMMARY_URL = 'https://tr.wikipedia.org/api/rest_v1/page/summary/';
const USER_AGENT = 'Pathwise/1.0 (Istanbul travel planner; enrichment)';

interface WikiSummaryResponse {
  title?: string;
  extract?: string;
  thumbnail?: { source?: string };
  content_urls?: { desktop?: { page?: string } };
}

/**
 * Fetches a short description + a real Wikimedia photo for a well-known place.
 * Pure fetcher — caching + fallback live in EnrichmentService.
 */
@Injectable()
export class WikipediaClient {
  private readonly logger = new Logger(WikipediaClient.name);

  async fetchSummary(title: string): Promise<WikipediaEnrichment | null> {
    try {
      const res = await fetch(WIKI_SUMMARY_URL + encodeURIComponent(title), {
        headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) throw new Error(`Wikipedia responded ${res.status}`);
      const body = (await res.json()) as WikiSummaryResponse;
      if (!body.extract) return null;

      return {
        title: body.title ?? title,
        summary: body.extract,
        thumbnailUrl: body.thumbnail?.source ?? null,
        pageUrl:
          body.content_urls?.desktop?.page ??
          `https://tr.wikipedia.org/wiki/${encodeURIComponent(title)}`,
        attribution: 'Wikipedia',
      };
    } catch (err) {
      this.logger.warn(`Wikipedia fetch failed for "${title}": ${String(err)}`);
      return null;
    }
  }
}
