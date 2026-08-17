/**
 * Live enrichment layered on top of the curated Place dataset. This sits beside
 * the repository/Strategy path — route generation never depends on it, so a slow
 * or failed external call can only ever hide the extra detail, never break a plan.
 */
export interface OsmEnrichment {
  /** Human-readable, parsed from OSM `opening_hours`. */
  openingHours: string | null;
  /** Original OSM syntax, kept for transparency. */
  openingHoursRaw: string | null;
  /** 'yes' | 'no' | 'limited' (OSM `wheelchair`). */
  wheelchair: string | null;
  /** OSM `cuisine` tag, if the POI is a food place. */
  cuisine: string | null;
  source: 'overpass';
}

export interface WikipediaEnrichment {
  title: string;
  summary: string;
  thumbnailUrl: string | null;
  pageUrl: string;
  /**
   * Attribution is a licence requirement — always shown in the UI.
   *
   * Naming the source is not sufficient on its own: Wikipedia's text is
   * CC BY-SA, and that licence asks for the licence to be named and linked
   * beside the credit. The panel showed "Source: Wikipedia" and stopped there,
   * which is the half of the obligation that is easy to remember.
   */
  attribution: 'Wikipedia';
  licence: string;
  licenceUrl: string;
}

export interface PlaceEnrichment {
  placeId: string;
  osm: OsmEnrichment | null;
  wikipedia: WikipediaEnrichment | null;
}
