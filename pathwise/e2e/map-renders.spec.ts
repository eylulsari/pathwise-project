import { test, expect } from '@playwright/test';

/**
 * The map disappeared in production while every existing test stayed green.
 *
 * `onboarding.spec.ts` already asserted `.leaflet-container` was visible and
 * that markers rendered — and both were true with every single tile blocked by
 * the Content-Security-Policy. Leaflet mounts its container, draws its markers
 * and its route line no matter what happens to the tile requests; what vanishes
 * is the photograph of Istanbul underneath them. So the container being present
 * is not evidence of a map, and this file asserts the pixels instead.
 *
 * There are two tests here because one of them cannot see the bug that caused
 * this. The browser test runs against whatever serves the SPA — locally that is
 * Vite, which sends no CSP at all, so tiles always load and the test always
 * passes. The header test asks the *backend* what policy it publishes, which is
 * the thing that differs between this machine and production.
 */

const TILE_HOST_PATTERN = /basemaps\.cartocdn\.com/;
const API_URL = process.env.E2E_API_URL ?? 'http://localhost:3000/api';

async function signUp(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/auth');
  await page.getByPlaceholder('Aylin Demir').fill('Map Tester');
  await page
    .getByPlaceholder('you@example.com')
    .fill(`e2e_map_${Date.now()}@std.antalya.edu.tr`);
  await page.getByPlaceholder('At least 8 characters').fill('secret123');
  await page.getByRole('button', { name: /Create account/i }).click();
  await page.waitForURL(/\/dashboard$/, { timeout: 15_000 });
}

test('the dashboard map paints real tiles, not just an empty container', async ({
  page,
}) => {
  const blocked: string[] = [];
  const cspViolations: string[] = [];

  // A CSP refusal is not a failed request — the browser never sends one. It
  // surfaces only as a console error, so both channels are watched.
  page.on('requestfailed', (req) => {
    if (TILE_HOST_PATTERN.test(req.url())) {
      blocked.push(`${req.url()} — ${req.failure()?.errorText ?? 'unknown'}`);
    }
  });
  page.on('console', (msg) => {
    if (msg.type() === 'error' && /Content Security Policy|Refused to/i.test(msg.text())) {
      cspViolations.push(msg.text());
    }
  });

  await signUp(page);
  await expect(page.locator('.leaflet-container')).toBeVisible();

  // Leaflet appends one <img class="leaflet-tile"> per tile in view.
  const tiles = page.locator('img.leaflet-tile');
  await expect(tiles.first()).toBeAttached({ timeout: 15_000 });

  // The assertion that matters: a blocked or 404ing image is still an <img> in
  // the DOM, still "visible" to a selector, and still 0 pixels wide once
  // decoded. naturalWidth is the only thing here that knows the difference.
  await expect
    .poll(
      async () =>
        tiles.evaluateAll(
          (imgs) => imgs.filter((i) => (i as HTMLImageElement).naturalWidth > 0).length,
        ),
      { timeout: 20_000, message: 'no tile image ever finished decoding' },
    )
    .toBeGreaterThan(0);

  expect(cspViolations).toEqual([]);
  expect(blocked).toEqual([]);
});

test('the check-in map paints tiles too', async ({ page }) => {
  await signUp(page);
  await page.getByRole('link', { name: /Social/i }).first().click();

  const map = page.getByTestId('checkin-map');
  await expect(map).toBeVisible();

  const tiles = map.locator('img.leaflet-tile');
  await expect(tiles.first()).toBeAttached({ timeout: 15_000 });
  await expect
    .poll(
      async () =>
        tiles.evaluateAll(
          (imgs) => imgs.filter((i) => (i as HTMLImageElement).naturalWidth > 0).length,
        ),
      { timeout: 20_000, message: 'check-in map never painted a tile' },
    )
    .toBeGreaterThan(0);
});

/**
 * This is the one that would have caught the outage.
 *
 * In production the API and the SPA are one origin, so the policy the backend
 * publishes is the policy the map runs under. Locally they are two origins and
 * the browser test above never sees this header — which is precisely how a
 * `img-src 'self' data:` default shipped with a full green suite.
 */
test('the backend publishes a CSP that permits the map, photos and routing', async ({
  request,
}) => {
  const res = await request.get(`${API_URL}/health`);
  expect(res.status()).toBe(200);

  const csp = res.headers()['content-security-policy'];
  expect(csp, 'the backend sends no CSP at all').toBeTruthy();

  const directive = (name: string): string => {
    const rule = csp
      .split(';')
      .map((r) => r.trim())
      .find((r) => r.startsWith(`${name} `));
    return rule ?? csp.split(';').find((r) => r.trim().startsWith('default-src ')) ?? '';
  };

  // Tiles and Wikipedia photos are images; OSRM is a fetch.
  expect(directive('img-src')).toContain('basemaps.cartocdn.com');
  expect(directive('img-src')).toContain('upload.wikimedia.org');
  expect(directive('connect-src')).toContain('router.project-osrm.org');

  // And the tile host again under connect-src: the service worker re-fetches
  // every tile itself, and a worker's fetch answers to connect-src rather than
  // img-src. Allowing it in only one of the two leaves the map blank with a
  // `net::ERR_FAILED` that mentions neither CSP nor the missing directive.
  expect(directive('connect-src')).toContain('basemaps.cartocdn.com');
});
