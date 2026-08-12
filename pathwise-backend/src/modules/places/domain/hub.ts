import { Hub } from './place';

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
  /** `Islands` is the Adalar ferry group — neither shore. */
  side: 'European' | 'Asian' | 'Islands';
  blurb: string;
  /** Map centre, [lat, lng] — where the map opens when this hub is selected. */
  center: [number, number];
  /** Hex accent used for the hub's map pins and chips. */
  accent: string;
}
