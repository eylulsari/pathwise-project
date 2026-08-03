/** The five neighborhood hubs Pathwise plans around. */
export type Hub =
  | 'sultanahmet'
  | 'karakoy-galata'
  | 'kadikoy-moda'
  | 'balat-fener'
  | 'besiktas-bogaz';

/** Interest categories used for scoring/filtering. */
export type Interest = 'food' | 'history' | 'photo' | 'market' | 'art' | 'nature';

/**
 * A visitable place. Field shapes mirror the real sources they'd come from:
 *  - place_id, lat/lng, rating, reviewCount, photoUrl, openingHours → Google Places
 *  - entryFeeTry, museumPass → IBB Open Data
 *  - isIndoor / isSunsetSpot → derived tags used by the weather/time simulator
 */
export interface Place {
  placeId: string; // Google Places `place_id`
  name: string;
  hub: Hub;
  lat: number;
  lng: number;
  rating: number; // Google 0–5
  reviewCount: number;
  photoUrl: string;
  category: Interest;
  interests: Interest[];
  entryFeeTry: number; // 0 = free
  avgFoodCostTry: number; // typical spend if this is a food stop
  avgVisitMinutes: number;
  openingHours: string; // human-readable, from Google opening_hours
  isIndoor: boolean; // used when it rains
  isSunsetSpot: boolean; // pushed toward end of day
  museumPass: boolean; // covered by the Istanbul Museum Pass (IBB)
  localTip: string;

  // ── Extended (optional) attributes ────────────────────────────────
  // Additive metadata layered on top of the Google/IBB-shaped core above.
  // All optional so the original curated dataset and every consumer (route
  // engine, tests) keep compiling unchanged; newer hubs populate them fully.
  // Mirrors the frontend `Place` shape so itinerary responses round-trip.
  neighborhood?: string; // fine-grained district within the hub
  crowdLevel?: 'low' | 'medium' | 'high';
  safetyScore?: number; // solo-traveler safety score, 0–100
  isSoloVerified?: boolean;
  transitNoteBefore?: string; // transit micro-tip from the previous stop
  insiderTip?: string; // specific actionable tip (distinct from localTip)
  photoGoldenHour?: string;
  priceTier?: 1 | 2 | 3 | 4;
  emoji?: string;
  source?: string;
}
