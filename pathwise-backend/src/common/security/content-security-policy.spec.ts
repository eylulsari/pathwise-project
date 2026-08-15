import express from 'express';
import helmet from 'helmet';
import { AddressInfo } from 'node:net';
import {
  CSP_DIRECTIVES,
  OSRM_HOST,
  TILE_HOST,
  WIKIMEDIA_HOST,
} from './content-security-policy';

/**
 * The header is asserted as a *policy*, not as a string.
 *
 * `expect(header).toContain('cartocdn')` would pass on a header that also said
 * `img-src 'none'`, and it would pass on a typo'd directive name. So the
 * response is served by the same helmet call `main.ts` makes, the header is
 * parsed back into directives, and each URL is matched against the rule that
 * would actually govern it in a browser.
 *
 * These three hosts have to keep working. Two of them fail visibly when they
 * do not; the OSRM one fails soft to a straight line on the map, which is why
 * it is pinned here rather than trusted to be noticed.
 */

/** Boots the real middleware and returns the CSP it sends. */
async function fetchCspHeader(): Promise<string> {
  const app = express();
  app.use(
    helmet({
      contentSecurityPolicy: { useDefaults: true, directives: CSP_DIRECTIVES },
    }),
  );
  app.get('/', (_req, res) => res.send('ok'));

  const server = app.listen(0);
  try {
    const { port } = server.address() as AddressInfo;
    const res = await fetch(`http://127.0.0.1:${port}/`);
    return res.headers.get('content-security-policy') ?? '';
  } finally {
    // `close()` alone waits on keep-alive sockets, which leaves Jest holding an
    // open handle after the suite has finished.
    server.closeAllConnections();
    server.close();
  }
}

function parseDirectives(header: string): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const rule of header.split(';')) {
    const [name, ...values] = rule.trim().split(/\s+/);
    if (name) out.set(name.toLowerCase(), values);
  }
  return out;
}

/**
 * Does `source` (a CSP source expression) match `url`?
 *
 * Only the subset this policy uses: `'self'`, an exact origin, and a
 * leading-`*` host wildcard — which the tile host needs, because Leaflet
 * expands `{s}` to a, b, c and d.
 */
function sourceMatches(source: string, url: URL, selfOrigin: string): boolean {
  if (source === "'self'") return url.origin === selfOrigin;
  if (!source.includes('://')) return false;
  const pattern = new URL(source.replace('*.', 'wildcard.'));
  if (pattern.protocol !== url.protocol) return false;
  if (source.includes('://*.')) {
    const suffix = pattern.hostname.replace('wildcard.', '');
    return url.hostname.endsWith(`.${suffix}`);
  }
  return pattern.hostname === url.hostname;
}

function allows(
  directives: Map<string, string[]>,
  directive: string,
  rawUrl: string,
): boolean {
  const sources = directives.get(directive) ?? directives.get('default-src');
  if (!sources) return true; // nothing constrains it
  const url = new URL(rawUrl);
  return sources.some((s) => sourceMatches(s, url, 'https://pathwise.example'));
}

describe('the production Content-Security-Policy', () => {
  let directives: Map<string, string[]>;

  beforeAll(async () => {
    directives = parseDirectives(await fetchCspHeader());
  });

  it('is sent at all', () => {
    expect(directives.size).toBeGreaterThan(0);
    expect(directives.has('default-src')).toBe(true);
  });

  it('lets the map load its tiles', () => {
    // Leaflet expands {s}; all four subdomains must pass, not just one.
    for (const s of ['a', 'b', 'c', 'd']) {
      expect(
        allows(
          directives,
          'img-src',
          `https://${s}.basemaps.cartocdn.com/light_all/12/2400/1540.png`,
        ),
      ).toBe(true);
    }
  });

  /**
   * The tile host has to be in `connect-src` as well, and the reason is not
   * obvious enough to survive without a test.
   *
   * The service worker runtime-caches tiles, so it intercepts each <img>
   * request and re-issues it with `fetch()`. A fetch from inside a worker is
   * governed by `connect-src`. Allowed by `img-src` alone, the browser permits
   * the image and then refuses the worker's fetch — and the failure arrives as
   * a bare `net::ERR_FAILED` that names neither CSP nor the directive, on a map
   * that looks exactly like a map with no tiles.
   */
  it('lets the service worker re-fetch those same tiles', () => {
    expect(
      allows(
        directives,
        'connect-src',
        'https://a.basemaps.cartocdn.com/dark_all/14/9512/6143.png',
      ),
    ).toBe(true);
  });

  it('lets place photos load from Wikipedia', () => {
    expect(
      allows(
        directives,
        'img-src',
        'https://upload.wikimedia.org/wikipedia/commons/thumb/d/df/x.jpg/330px-x.jpg',
      ),
    ).toBe(true);
  });

  it('lets the client fetch walking geometry from OSRM', () => {
    expect(
      allows(
        directives,
        'connect-src',
        'https://router.project-osrm.org/route/v1/foot/29,41;29,41',
      ),
    ).toBe(true);
  });

  it('still allows the same-origin API and inline data URIs', () => {
    expect(allows(directives, 'connect-src', 'https://pathwise.example/api/places')).toBe(
      true,
    );
    expect(directives.get('img-src')).toContain('data:');
  });

  /**
   * The point of an allowlist is what it refuses. If this ever goes green
   * against an arbitrary host, someone has widened a directive to `https:` and
   * the policy has stopped being a policy.
   */
  it('refuses a host nobody put on the list', () => {
    expect(allows(directives, 'img-src', 'https://evil.example/tracker.png')).toBe(false);
    expect(allows(directives, 'connect-src', 'https://evil.example/collect')).toBe(false);
  });

  it('keeps helmet’s defaults for everything not overridden', () => {
    expect(directives.get('default-src')).toEqual(["'self'"]);
    expect(directives.get('object-src')).toEqual(["'none'"]);
    expect(directives.get('script-src')).toEqual(["'self'"]);
  });

  it('names every host the app actually talks to', () => {
    // Guards against a directive being edited to drop a host while the
    // constants above still claim it is supported.
    const img = directives.get('img-src') ?? [];
    expect(img).toContain(TILE_HOST);
    expect(img).toContain(WIKIMEDIA_HOST);
    const connect = directives.get('connect-src') ?? [];
    expect(connect).toContain(OSRM_HOST);
    expect(connect).toContain(TILE_HOST);
  });
});
