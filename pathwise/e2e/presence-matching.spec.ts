import { test, expect, type Page } from '@playwright/test';
import { dismissWelcome } from './helpers/welcome';

/**
 * Check-in presence (the "available now" layer) and the buddy-matching UI.
 *
 * The matching specs close a gap TESTING.md carried as ⚠️: the score and the
 * style picker were verified at the API level but had never been looked at in
 * a browser.
 *
 * Requires the stack running (docker compose up -d).
 */

async function signUp(page: Page, tag: string) {
  const email = `pm_${tag}_${Date.now()}@std.antalya.edu.tr`;
  await page.goto('/auth');
  await page.getByPlaceholder('Aylin Demir').fill('Presence Tester');
  await page.getByPlaceholder('you@example.com').fill(email);
  await page.getByPlaceholder('At least 8 characters').fill('secret123');
  await page.getByRole('button', { name: /Create account/i }).click();
  await page.waitForURL(/\/dashboard$/, { timeout: 20_000 });
  await dismissWelcome(page);
}

const rows = (page: Page) => page.getByTestId('checkin-row');

// ── Presence ──────────────────────────────────────────────────────────

test('the check-in feed separates recent travelers from older ones', async ({ page }) => {
  await signUp(page, 'feed');
  await page.goto('/social');

  await expect(rows(page).first()).toBeVisible({ timeout: 20_000 });

  // The seed spans both sides of the two-hour window on purpose, so both
  // states must actually be on screen — a feed that rendered everything as
  // one state would still satisfy a weaker "a badge exists" assertion.
  await expect(rows(page).and(page.locator('[data-presence="live"]')).first()).toBeVisible();
  await expect(rows(page).and(page.locator('[data-presence="stale"]')).first()).toBeVisible();

  // The newest entry (8 minutes old in the seed) is inside the window.
  const newest = rows(page).first();
  await expect(newest).toHaveAttribute('data-presence', 'live');
  await expect(newest.getByText(/Available now/i)).toBeVisible();

  // The oldest (4 hours) is outside it.
  const oldest = rows(page).last();
  await expect(oldest).toHaveAttribute('data-presence', 'stale');
  await expect(oldest.getByText(/Checked in earlier/i)).toBeVisible();
});

test('a fresh check-in from the composer is marked available immediately', async ({ page }) => {
  await signUp(page, 'compose');
  await page.goto('/social');
  await expect(rows(page).first()).toBeVisible({ timeout: 20_000 });

  await page.getByPlaceholder(/.+/).first().fill('Testing presence right now');
  await page.getByRole('button', { name: /I.m Here/i }).click();

  const mine = rows(page).first();
  await expect(mine).toContainText('Testing presence right now', { timeout: 10_000 });
  await expect(mine).toHaveAttribute('data-presence', 'live');
});

test('a posted check-in survives a full page reload', async ({ page }) => {
  await signUp(page, 'persist');
  await page.goto('/social');
  await expect(rows(page).first()).toBeVisible({ timeout: 20_000 });

  // A seed entry, 8 minutes old — the newest of the curated ones.
  const NEWEST_SEED = 'Golden hour is unreal up here 🌇';
  const message = `persisted at ${Date.now()}`;

  await page.getByPlaceholder(/.+/).first().fill(message);
  await page.getByRole('button', { name: /I.m Here/i }).click();
  await expect(page.getByText(message)).toBeVisible({ timeout: 15_000 });

  // The point of the test: reload, so nothing survives in memory. Anything
  // still on screen came back from the database.
  await page.reload();
  await expect(rows(page).first()).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText(message)).toBeVisible({ timeout: 15_000 });

  // A just-posted check-in is live, and the curated seed is still there beside
  // it — the feed merges both sources rather than replacing one.
  const mine = rows(page).filter({ hasText: message });
  await expect(mine).toHaveAttribute('data-presence', 'live');
  await expect(page.getByText(NEWEST_SEED)).toBeVisible();

  // Ordering: mine is newer than every seed entry, so it sits above them.
  //
  // Asserted by relative position rather than "is row 0", and never by an
  // exact row count: the feed is shared, so a parallel spec posting its own
  // check-in legitimately changes both the count and who is literally first.
  const texts = await rows(page).allTextContents();
  const mineAt = texts.findIndex((t) => t.includes(message));
  const seedAt = texts.findIndex((t) => t.includes(NEWEST_SEED));
  expect(mineAt).toBeGreaterThanOrEqual(0);
  expect(seedAt).toBeGreaterThan(mineAt);
});

test('the check-in map renders pins, and only recent ones pulse', async ({ page }) => {
  await signUp(page, 'map');
  await page.goto('/social');

  const map = page.getByTestId('checkin-map');
  await expect(map).toBeVisible({ timeout: 20_000 });
  // Leaflet actually painted (not a 0px container).
  await expect(map.locator('.leaflet-container')).toBeVisible();

  const pins = map.locator('.pw-checkin-pin');
  await expect(pins.first()).toBeVisible({ timeout: 20_000 });
  expect(await pins.count()).toBeGreaterThan(1);

  // The live/stale distinction is what the whole feature is: both classes
  // must be present, or the map is showing one undifferentiated state.
  expect(await map.locator('.pw-checkin-pin--live').count()).toBeGreaterThan(0);
  expect(await map.locator('.pw-checkin-pin:not(.pw-checkin-pin--live)').count()).toBeGreaterThan(0);

  // The promise stays honest: this is not location tracking.
  await expect(page.getByText(/not where they are now|takip edilmiyor/i)).toBeVisible();
});

// ── Buddy matching UI (previously API-verified only) ──────────────────

/**
 * ⚠️ This test now builds its own candidates.
 *
 * Ranking used to run over the demo seed, so a lone account could open /social
 * and see thirty ranked cards. That was the bug, not a convenience: the
 * percentages described how well a real person would get along with a fixture.
 * Only real accounts are scored now, which means this spec has to create the
 * people it ranks — two of them, since "best first" needs something to be
 * first *of*.
 */
test('travel styles can be picked in the profile and drive the match score', async ({
  page,
  browser,
}) => {
  test.setTimeout(120_000);

  // Two other accounts with different styles, so the scores actually differ.
  const others = [];
  for (const [tag, style] of [
    ['match_a', '#Foodie'],
    ['match_b', '#Backpacker'],
  ] as const) {
    const ctx = await browser.newContext();
    const p = await ctx.newPage();
    await signUp(p, tag);
    await p.goto('/profile');
    const chip = p.getByRole('button', { name: style, exact: true });
    await expect(chip).toBeVisible({ timeout: 20_000 });
    await chip.click();
    await expect(chip).toHaveAttribute('aria-pressed', 'true', { timeout: 15_000 });
    others.push(ctx);
  }

  await signUp(page, 'match');

  // A brand-new account has nothing to match on, so no percentage is shown —
  // the UI must not invent one.
  await page.goto('/social');
  await expect(page.getByTestId('traveler-card').first()).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId('traveler-card').getByText(/% *\d/)).toHaveCount(0);
  await expect(page.getByText(/Add your travel styles/i)).toBeVisible();

  // Pick a style in the profile.
  await page.goto('/profile');
  const foodie = page.getByRole('button', { name: '#Foodie', exact: true });
  await expect(foodie).toBeVisible({ timeout: 20_000 });
  await foodie.click();
  await expect(foodie).toHaveAttribute('aria-pressed', 'true', { timeout: 15_000 });

  // Now the list is ranked and each card explains itself.
  await page.goto('/social');
  const cards = page.getByTestId('traveler-card');
  await expect(cards.first()).toBeVisible({ timeout: 20_000 });
  await expect(cards.first().getByText(/Match/i)).toBeVisible({ timeout: 20_000 });
  await expect(cards.first().getByText(/%\d+/)).toBeVisible();

  // Best match first: the top card must score at least as high as the next.
  const score = async (index: number) => {
    const text = await cards.nth(index).getByText(/%\d+/).textContent();
    return Number((text ?? '').replace(/\D/g, ''));
  };
  expect(await score(0)).toBeGreaterThanOrEqual(await score(1));

  // The sample profiles are NOT ranked — a percentage there would be a number
  // about nobody, which is exactly what this list used to be full of.
  await expect(page.getByTestId('sample-card').first()).toBeVisible();
  await expect(page.getByTestId('sample-card').getByText(/% *\d/)).toHaveCount(0);

  for (const ctx of others) await ctx.close();
});
