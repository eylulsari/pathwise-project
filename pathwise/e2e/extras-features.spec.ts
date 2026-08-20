import { test, expect, type Page } from '@playwright/test';
import { dismissWelcome } from './helpers/welcome';
import { openFromMoreMenu } from './helpers/nav';

/** Feature regression — smaller / partial features. Runs via `npm run e2e`. */

async function signup(page: Page, tag: string) {
  const email = `xtra_${tag}_${Date.now()}@std.antalya.edu.tr`;
  await page.goto('/auth');
  await page.getByPlaceholder('Aylin Demir').fill(`${tag} Tester`);
  await page.getByPlaceholder('you@example.com').fill(email);
  await page.getByPlaceholder('At least 8 characters').fill('secret123');
  await page.getByRole('button', { name: /Create account/i }).click();
  await page.waitForURL(/\/dashboard$/, { timeout: 20_000 });
  await dismissWelcome(page);
  await expect(page.getByRole('heading', { name: /Today.s Path/i })).toBeVisible();
  return email;
}

test('survival widget expands a category', async ({ page }) => {
  await signup(page, 'survival');
  const card = page.locator('div.rounded-2xl', { hasText: 'City Survival & Etiquette' }).first();
  await expect(card).toBeVisible();
  await card.getByRole('button').nth(1).click();
  await expect(card.locator('li').first()).toBeVisible();
});

test('weather widget shows a temperature in the header', async ({ page }) => {
  await signup(page, 'weather');
  await expect(page.getByText(/\d+°/).first()).toBeVisible({ timeout: 10_000 });
});

test('one-click time anchor pins a stop', async ({ page }) => {
  await signup(page, 'anchor');
  await page.getByRole('button', { name: /Lock time/i }).first().click();
  await expect(page.getByRole('button', { name: /⚓ Locked/i }).first()).toBeVisible({ timeout: 15_000 });
});

test('nearby suggestion can be added to the path', async ({ page }) => {
  await signup(page, 'suggest');

  // Use the plan the dashboard builds on load rather than regenerating first.
  //
  // An effect refetches the suggestion whenever the itinerary changes, so
  // regenerating opens a window where the panel still shows the PREVIOUS plan's
  // suggestion while a new request is in flight: the test reads one place, and
  // by the time it clicks Add the app is holding another. Nothing observable
  // closes that window — waiting on a `suggest-nearby` response can match the
  // page-load request instead, and `networkidle` can resolve in the gap between
  // the generate response and the effect firing. With no regeneration exactly
  // one suggestion is ever fetched, so the label and the action cannot disagree.
  const panel = page.locator('div').filter({ hasText: /Nearby:/i }).last();
  await expect(panel).toBeVisible({ timeout: 15_000 });
  const raw = await panel.locator('span').first().textContent();
  const name = (raw ?? '').replace(/.*Nearby:\s*/i, '').split(' —')[0].trim();
  expect(name).not.toBe('');

  await panel.getByRole('button', { name: /Add to Today.s Path/i }).click();
  await expect(page.locator('ol li h3', { hasText: name })).toBeVisible({ timeout: 15_000 });
});

test('setting a hotel start point anchors the route', async ({ page }) => {
  await signup(page, 'origin');
  await page.getByRole('button', { name: /🏨 Hotel/ }).first().click(); // Start selector (End also has one)
  await page.getByPlaceholder(/Hotel name/i).first().fill('Sirkeci Mansion');
  await page.getByRole('button', { name: 'Set', exact: true }).first().click();
  await expect(page.getByText(/Starting from/i)).toBeVisible();
  await page.getByRole('button', { name: /Generate My Custom Path/i }).click();
  await expect(page.locator('ol li h3').first()).toBeVisible({ timeout: 15_000 });
});

test('an over-budget plan raises a budget notification', async ({ page }) => {
  await signup(page, 'budget');
  await page.locator('input[type=range]').nth(0).fill('300');
  await page.locator('input[type=range]').nth(1).fill('8');
  await page.getByRole('button', { name: /Generate My Custom Path/i }).click();
  await expect(page.getByRole('heading', { name: /Today.s Path/i })).toBeVisible();
  await page.getByRole('button', { name: 'Notifications' }).click();
  await expect(page.getByText('💸').first()).toBeVisible({ timeout: 12_000 });
});

test('marking a review helpful increments its count', async ({ page }) => {
  await signup(page, 'helpful');
  await page.getByRole('button', { name: /Read Local Story/i }).first().click();
  await expect(page.getByRole('heading', { name: /Reviews/i })).toBeVisible();

  // Post the review this test then marks helpful.
  //
  // It used to reach straight for the first "👍 Helpful" button and depend on
  // a review left by `onboarding.spec.ts`. That is an ordering dependency
  // dressed up as flakiness: reviews live in Postgres, CI starts every run on
  // an empty database, and whether the button exists came down to which spec
  // happened to run first. On a fresh database with this test running early
  // there is nothing to mark helpful and it waits out the whole timeout.
  const text = `Helpful target ${Date.now()}`;
  await page.getByPlaceholder(/Share your experience/i).fill(text);
  await page.getByRole('button', { name: /Post review/i }).click();
  // The row carries a testid rather than being fished out by tag name: a
  // `filter({ hasText })` over `div` also matches every ancestor that contains
  // the text, and picking one of those by position is a guess that happens to
  // work until the markup nests one level deeper.
  const review = page.getByTestId('review').filter({ hasText: text });
  await expect(review).toBeVisible({ timeout: 10_000 });

  const btn = review.getByRole('button', { name: /👍 Helpful/i }).first();
  const before = await btn.textContent();
  await btn.click();
  await expect.poll(async () => btn.textContent(), { timeout: 10_000 }).not.toBe(before);
});

test('map fullscreen toggles', async ({ page }) => {
  await signup(page, 'fs');
  await page.getByRole('button', { name: /Full screen/i }).click();
  await expect(page.getByRole('button', { name: /Close/i })).toBeVisible();
  await page.getByRole('button', { name: /✕ Close/i }).click();
  await expect(page.getByRole('button', { name: /Full screen/i })).toBeVisible();
});

test('a stop can be dragged onto Day 2', async ({ page }) => {
  await signup(page, 'crossday');
  const names = page.locator('ol li h3');
  await expect(names.nth(1)).toBeVisible();
  const before = await names.allTextContents();
  const handle = page.getByRole('button', { name: 'Drag to reorder' }).first();
  const day2 = page.getByRole('button', { name: /Day 2/ });
  const hb = await handle.boundingBox();
  const d2 = await day2.boundingBox();
  if (hb && d2) {
    await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2);
    await page.mouse.down();
    await page.mouse.move(hb.x + hb.width / 2, hb.y - 10, { steps: 5 });
    await page.mouse.move(d2.x + d2.width / 2, d2.y + d2.height / 2, { steps: 12 });
    await page.mouse.up();
  }
  await expect
    .poll(async () => (await names.allTextContents()).length, { timeout: 10_000 })
    .toBeLessThan(before.length);
});

test('free user sees the locked audio guide in the story modal', async ({ page }) => {
  await signup(page, 'gating');
  await openFromMoreMenu(page, /Premium/);
  await page.waitForURL(/\/premium$/);
  await page.getByRole('button', { name: /Switch to Free/i }).click();
  await expect(page.getByRole('button', { name: /Upgrade to Premium/i })).toBeVisible({ timeout: 10_000 });
  await page.getByRole('link', { name: 'Plan', exact: true }).click();
  await page.waitForURL(/\/dashboard$/);
  await page.getByRole('button', { name: /Read Local Story/i }).first().click();
  await expect(page.getByText(/Full audio guide/i)).toBeVisible();
  await expect(page.getByText(/Unlock with Premium/i).first()).toBeVisible();
});

test('a stale access token is rotated on reload (refresh flow)', async ({ page }) => {
  await signup(page, 'refresh');
  await page.evaluate(() => localStorage.setItem('pathwise.access', 'stale.invalid.token'));
  await page.reload();
  await expect(page.getByRole('heading', { name: /Today.s Path/i })).toBeVisible({ timeout: 20_000 });
});
