import { Hub } from './place';

/**
 * Which body of land a hub sits on.
 *
 * Not decoration: the route engine reads this to decide whether moving between
 * two stops means a walk or a boat. `Islands` is the Adalar group, reachable
 * only by a scheduled ferry and therefore neither shore.
 */
export type HubSide = 'European' | 'Asian' | 'Islands';

/**
 * Presentation metadata for a hub.
 *
 * Hubs used to exist only as a string union on the backend and a hand-written
 * array on the frontend, which meant the map centre, accent colour and blurb
 * for a neighborhood lived in the client and nowhere else. Moving them here
 * makes the backend the single source for both halves of the app: the frontend
 * copy is generated from this dataset rather than maintained beside it.
 */
export interface HubMeta {
  id: Hub;
  name: string;
  side: HubSide;
  blurb: string;
  /** Map centre, [lat, lng] — where the map opens when this hub is selected. */
  center: [number, number];
  /** Hex accent used for the hub's map pins and chips. */
  accent: string;
}
