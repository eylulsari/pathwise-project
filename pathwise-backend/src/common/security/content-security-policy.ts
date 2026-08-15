/**
 * The Content-Security-Policy for the single-origin deployment.
 *
 * WHY THIS FILE EXISTS
 * `helmet()` with no arguments ships a CSP whose image rule is
 * `img-src 'self' data:`. While the API and the SPA were two origins that was
 * harmless: the header rode on JSON responses, which load nothing. Serving the
 * built SPA from this same process put the header on the **HTML document**, and
 * from that moment the browser enforced it against every subresource the page
 * asks for.
 *
 * Three things broke in production and none of them broke locally, because in
 * development Vite serves the document and sets no CSP at all:
 *
 * - every map tile (`*.basemaps.cartocdn.com`) — the visible symptom;
 * - every place photo (`upload.wikimedia.org`), 108 of them;
 * - the walking route geometry (`router.project-osrm.org`), which fails soft
 *   to a straight line, so it broke *silently*.
 *
 * The lesson is in the third one: a CSP failure looks like a feature that was
 * never built. Nothing throws, nothing 500s, and the server log is clean.
 *
 * ADDING AN EXTERNAL SOURCE
 * Any new third-party image, font, script or fetch target has to be named here
 * or it will not load in production — and it *will* still work on your machine.
 * `content-security-policy.spec.ts` asserts each host below is actually
 * reachable under the policy, so add the host and add the case.
 *
 * Hosts are listed individually rather than allowed with a bare `https:`.
 * A wildcard would have prevented this outage too, but it also permits any
 * server on the internet to supply an image or receive a fetch, which is most
 * of what a CSP is for.
 */

/** Map tiles. `{s}` in the Leaflet URL expands to a, b, c or d. */
export const TILE_HOST = 'https://*.basemaps.cartocdn.com';

/** Place photos, from the Wikipedia enrichment payload's `thumbnailUrl`. */
export const WIKIMEDIA_HOST = 'https://upload.wikimedia.org';

/** Street-following walking geometry between stops, fetched by the client. */
export const OSRM_HOST = 'https://router.project-osrm.org';

export const CSP_DIRECTIVES = {
  // Tiles and photos are cross-origin images; `data:` covers inline icons.
  'img-src': ["'self'", 'data:', TILE_HOST, WIKIMEDIA_HOST],
  // The API is same-origin; OSRM is the one external endpoint the client calls
  // directly. Everything else (weather, currency, Wikipedia, Overpass) is
  // proxied through this server precisely so it stays same-origin.
  //
  // TILE_HOST is here as well as in `img-src`, and that is not redundant. The
  // service worker runtime-caches tiles (`CacheFirst`, see vite.config.ts), so
  // it intercepts the <img> request and re-issues it as `fetch()` from inside
  // the worker — and a worker's fetch is governed by `connect-src`, not
  // `img-src`. With the host in `img-src` alone the browser permits the image
  // and then the worker's own fetch is refused, which surfaces as a bare
  // `net::ERR_FAILED` with no mention of CSP anywhere.
  'connect-src': ["'self'", OSRM_HOST, TILE_HOST],
} as const;
