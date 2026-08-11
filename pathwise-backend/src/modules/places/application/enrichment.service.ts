import { Injectable, Logger } from '@nestjs/common';
import { MemoryStoreService } from '../../../infrastructure/cache/memory-store.service';
import { PlacesService } from './places.service';
import { OverpassClient } from '../infrastructure/enrichment/overpass.client';
import { WikipediaClient } from '../infrastructure/enrichment/wikipedia.client';
import {
  OsmEnrichment,
  PlaceEnrichment,
  WikipediaEnrichment,
} from '../domain/place-enrichment';

/**
 * Turkish Wikipedia titles for a small allowlist of iconic places. We only
 * enrich these 6 to keep requests focused and the photos genuinely relevant
 * (per spec: 5–8 well-known landmarks).
 */
const WIKI_TITLES: Record<string, string> = {
  'ChIJ-sultanahmet-hagiasophia': 'Ayasofya',
  'ChIJ-sultanahmet-bluemosque': 'Sultan Ahmet Camii',
  'ChIJ-sultanahmet-topkapi': 'Topkapı Sarayı',
  'ChIJ-sultanahmet-basilicacistern': 'Yerebatan Sarnıcı',
  'ChIJ-sultanahmet-grandbazaar': 'Kapalıçarşı',
  'ChIJ-galata-tower': 'Galata Kulesi',
};

const OSM_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days
const WIKI_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days

/**
 * Enrichment layer that sits *beside* the PlaceRepositoryPort/Strategy path.
 * It composes live OSM (Overpass) and Wikipedia data for a place, cached in
 * the in-process cache. Every external failure degrades to null for that slice — callers keep
 * their curated mock values, so nothing here is load-bearing.
 */
@Injectable()
export class EnrichmentService {
  private readonly logger = new Logger(EnrichmentService.name);

  constructor(
    private readonly places: PlacesService,
    private readonly overpass: OverpassClient,
    private readonly wikipedia: WikipediaClient,
    private readonly store: MemoryStoreService,
  ) {}

  async getEnrichment(placeId: string): Promise<PlaceEnrichment> {
    const [place] = await this.places.findByIds([placeId]);
    if (!place) return { placeId, osm: null, wikipedia: null };

    const [osm, wiki] = await Promise.all([
      this.osmFor(place.placeId, place.name, place.lat, place.lng),
      this.wikiFor(place.placeId),
    ]);
    return { placeId, osm, wikipedia: wiki };
  }

  private async osmFor(
    placeId: string,
    name: string,
    lat: number,
    lng: number,
  ): Promise<OsmEnrichment | null> {
    return this.cached(
      `enrich:osm:${placeId}`,
      OSM_TTL_SECONDS,
      () => this.overpass.fetchNearbyTags(name, lat, lng),
    );
  }

  private async wikiFor(placeId: string): Promise<WikipediaEnrichment | null> {
    const title = WIKI_TITLES[placeId];
    if (!title) return null; // not on the allowlist → no Wikipedia enrichment
    return this.cached(
      `enrich:wiki:${placeId}`,
      WIKI_TTL_SECONDS,
      () => this.wikipedia.fetchSummary(title),
    );
  }

  /**
   * Read-through in-process cache. Caches both hits and misses (misses briefly, as
   * `null`) so a landmark with no OSM tags doesn't hammer Overpass every load.
   * Cache errors are swallowed — the fetch still runs.
   */
  private async cached<T>(
    key: string,
    ttl: number,
    fetcher: () => Promise<T | null>,
  ): Promise<T | null> {
    try {
      const hit = await this.store.get(key);
      if (hit !== null) return JSON.parse(hit) as T | null;
    } catch (err) {
      this.logger.warn(`Cache read failed for ${key}: ${String(err)}`);
    }

    const value = await fetcher();

    try {
      // Cache a miss for a shorter window (1 day) than a hit.
      const effectiveTtl = value === null ? 24 * 60 * 60 : ttl;
      await this.store.setWithTtl(key, JSON.stringify(value), effectiveTtl);
    } catch (err) {
      this.logger.warn(`Cache write failed for ${key}: ${String(err)}`);
    }
    return value;
  }
}
