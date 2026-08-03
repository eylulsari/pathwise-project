import { Injectable, Logger } from '@nestjs/common';
import { OsmEnrichment } from '../../domain/place-enrichment';
import { parseOsmOpeningHours } from './osm-hours.parser';

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
// Overpass rejects requests without a descriptive User-Agent (returns 406).
const USER_AGENT = 'Pathwise/1.0 (Istanbul travel planner; enrichment)';

interface OverpassElement {
  tags?: Record<string, string>;
}

/**
 * Reads live OSM tags (opening_hours, wheelchair, cuisine) for a named POI via
 * the Overpass API. Pure fetcher — caching + fallback live in EnrichmentService.
 */
@Injectable()
export class OverpassClient {
  private readonly logger = new Logger(OverpassClient.name);

  async fetchNearbyTags(
    _name: string,
    lat: number,
    lng: number,
  ): Promise<OsmEnrichment | null> {
    // Match by proximity, not name: OSM labels landmarks in Turkish ("Ayasofya"
    // vs our "Hagia Sophia"), so a name filter misses them. A tight radius over
    // the curated coordinate plus tag-based scoring lands on the right feature.
    const query =
      `[out:json][timeout:15];` +
      `nwr(around:85,${lat},${lng})["name"];` +
      `out tags 40;`;

    let elements: OverpassElement[];
    try {
      const res = await fetch(OVERPASS_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': USER_AGENT,
        },
        body: `data=${encodeURIComponent(query)}`,
        signal: AbortSignal.timeout(12000),
      });
      if (!res.ok) throw new Error(`Overpass responded ${res.status}`);
      const body = (await res.json()) as { elements?: OverpassElement[] };
      elements = body.elements ?? [];
    } catch (err) {
      this.logger.warn(`Overpass fetch failed for "${_name}": ${String(err)}`);
      return null;
    }

    // Prefer the element carrying the most useful tags.
    const tagged = elements
      .map((e) => e.tags ?? {})
      .filter((t) => t.opening_hours || t.wheelchair || t.cuisine);
    if (tagged.length === 0) return null;
    const best = tagged.sort(
      (a, b) => score(b) - score(a),
    )[0];

    return {
      openingHours: parseOsmOpeningHours(best.opening_hours),
      openingHoursRaw: best.opening_hours ?? null,
      wheelchair: best.wheelchair ?? null,
      cuisine: best.cuisine ?? null,
      source: 'overpass',
    };
  }
}

/**
 * Rank candidates so the POI we care about wins over incidental neighbours
 * (benches, side shops): reward the enrichment tags, then bias toward the kind
 * of feature the coordinate represents — a major sight or a food venue.
 */
function score(t: Record<string, string>): number {
  let s =
    (t.opening_hours ? 2 : 0) + (t.wheelchair ? 1 : 0) + (t.cuisine ? 1 : 0);
  if (t.historic) s += 3;
  if (['attraction', 'museum', 'viewpoint', 'artwork'].includes(t.tourism)) s += 3;
  if (t.cuisine && ['restaurant', 'cafe', 'fast_food'].includes(t.amenity)) s += 2;
  return s;
}
