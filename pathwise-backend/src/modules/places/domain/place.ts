/**
 * The ten neighborhood hubs Pathwise plans around.
 *
 * `balat-fener` and `besiktas-bogaz` keep their original two-word slugs even
 * though the newer hubs are single-word: `check_ins.hub` stores these strings
 * and production already holds rows carrying them. Renaming would strand that
 * data for a cosmetic gain.
 */
export type Hub =
  | 'sultanahmet'
  | 'eminonu-sirkeci'
  | 'beyoglu-taksim'
  | 'karakoy-galata'
  | 'besiktas-bogaz'
  | 'ortakoy-bebek'
  | 'balat-fener'
  | 'kadikoy-moda'
  | 'uskudar'
  | 'adalar';

/**
 * Interest categories used for scoring/filtering.
 *
 * The first six are the original set. The eight after them were added with the
 * 129-place expansion: the curated data carried tags like "view" and
 * "hiddengem" that no existing value could absorb without inventing a meaning,
 * and dropping them left thirteen places with an empty `interests` array —
 * scored on `rating` alone and effectively invisible to the engine.
 */
export type Interest =
  | 'food'
  | 'history'
  | 'photo'
  | 'market'
  | 'art'
  | 'nature'
  | 'view'
  | 'hiddengem'
  | 'relax'
  | 'local'
  | 'culture'
  | 'nightlife'
  | 'experience'
  | 'religion';

/**
 * What a place physically *is*, as opposed to what it appeals to (`Interest`).
 * The two are orthogonal — a mosque can be `history` + `architecture`-ish, a
 * viewpoint can be `photo` + `relax` — so this is a separate axis rather than
 * a widening of `category`.
 */
export type PlaceType =
  | 'landmark'
  | 'museum'
  | 'mosque'
  | 'church'
  | 'market'
  | 'food'
  | 'park'
  | 'viewpoint'
  | 'street'
  | 'beach'
  | 'experience';

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
  /**
   * The ticket price is an unverified estimate — the UI renders it as "~₺600".
   *
   * Every non-zero fee in this dataset carries the flag, not just the ones
   * added by the 129-place expansion. No price here came from a live source
   * (see the mocked-data note in README), so flagging only the newer half would
   * imply the older half had been verified. `entryFeeTry: 0` is never flagged:
   * "free" is a fact about the place, not an estimate of a number.
   */
  entryFeeApprox?: boolean;
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
  placeType?: PlaceType; // what it is, orthogonal to `category`
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
