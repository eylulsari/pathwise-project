import { test, expect } from '@playwright/test';
import { dismissWelcome } from './helpers/welcome';

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
  await dismissWelcome(page);
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

/**
 * The workspace must fit the window it is given.
 *
 * It did not. At 1600×900 the layout grid measured 2426px and the map 2394px —
 * nearly three screens of map, with the page scrolling past it. The declared
 * `xl:h-[calc(100vh-155px)]` never applied: the grid is a flex child with
 * `flex-1`, and `flex-1` sets `flex-basis: 0`, which takes over main-axis
 * sizing from any height the element is also given. With a `min-h-screen`
 * (auto-height) parent, the free space that basis is measured against comes
 * from the content, so the grid grew to fit its tallest column.
 *
 * Two things were needed, and each was measured to be load-bearing on its own:
 * a shell that is exactly one viewport tall from `xl` up, so there is a real
 * height to distribute, and `min-h-0` on the grid and its items, so they may
 * shrink below their content instead of pushing the row open again. With
 * either one missing the grid measures 2426px.
 */
test('the desktop workspace fits the viewport, and its columns scroll inside it', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  await signUp(page);
  await expect(page.getByRole('heading', { name: /Today.s Path/i })).toBeVisible({
    timeout: 25_000,
  });

  const geometry = await page.evaluate(() => {
    const grid = document.querySelector('div.grid.flex-1') as HTMLElement | null;
    if (!grid) return null;
    const columns = Array.from(grid.children).map((el) => ({
      height: Math.round((el as HTMLElement).getBoundingClientRect().height),
      scrollHeight: (el as HTMLElement).scrollHeight,
    }));
    return {
      viewport: window.innerHeight,
      grid: Math.round(grid.getBoundingClientRect().height),
      columns,
    };
  });

  expect(geometry).not.toBeNull();
  // The whole workspace inside one screen, not three.
  expect(geometry!.grid).toBeLessThanOrEqual(geometry!.viewport);

  // Every column the same height as the row — including the map, which is what
  // reads as broken when the row runs away.
  for (const column of geometry!.columns) {
    expect(column.height).toBeLessThanOrEqual(geometry!.viewport);
  }

  // And the tall column really scrolls rather than stretching the page: its
  // content is taller than the box it is shown in.
  expect(Math.max(...geometry!.columns.map((c) => c.scrollHeight))).toBeGreaterThan(
    geometry!.grid,
  );
});
