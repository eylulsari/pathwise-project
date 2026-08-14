import { test, expect, type Page } from '@playwright/test';

/**
 * Feature regression — planning / account / content (the previously-untested
 * "high priority" set). Runs against the live stack via `npm run e2e`.
 */

async function signup(page: Page, tag: string) {
  const email = `feat_${tag}_${Date.now()}@std.antalya.edu.tr`;
  await page.goto('/auth');
  await page.getByPlaceholder('Aylin Demir').fill(`${tag} Tester`);
  await page.getByPlaceholder('you@example.com').fill(email);
  await page.getByPlaceholder('At least 8 characters').fill('secret123');
  await page.getByRole('button', { name: /Create account/i }).click();
  await page.waitForURL(/\/dashboard$/, { timeout: 20_000 });
  return email;
}

test('AI assistant answers a question (real backend round-trip)', async ({ page }) => {
  await signup(page, 'ai');
  await page.getByRole('button', { name: 'AI assistant' }).click();
  await expect(page.getByText(/Ask me for a sunset spot/i)).toBeVisible();
  await page.getByRole('button', { name: 'Best sunset spot?' }).click();
  await expect(page.getByText(/Assistant is typing/i)).toBeHidden({ timeout: 30_000 });
  await expect(page.getByText(/couldn.t reach the assistant/i)).toHaveCount(0);
});

test('Vibe Quiz completes all 3 steps and rebuilds the route', async ({ page }) => {
  await signup(page, 'quiz');
  await expect(page.getByRole('heading', { name: /Today.s Path/i })).toBeVisible();
  await page.getByRole('button', { name: /Vibe Quiz/i }).click();
  await expect(page.getByText(/What's your mood/i)).toBeVisible();
  await page.getByRole('button', { name: 'History Buff' }).click();
  await page.getByRole('button', { name: /Next/i }).click();
  await page.getByRole('button', { name: 'Relaxed' }).click();
  await page.getByRole('button', { name: /Next/i }).click();
  await page.getByRole('button', { name: /Build my path/i }).click();
  await expect(page.getByText(/What's your mood/i)).toHaveCount(0);
  await expect(page.locator('ol li h3').first()).toBeVisible({ timeout: 15_000 });
});

test('Must-Visit picks auto-apply on close with a toast', async ({ page }) => {
  await signup(page, 'mv');
  await expect(page.getByRole('heading', { name: /Today.s Path/i })).toBeVisible();
  await page.getByRole('button', { name: /Must-Visit/i }).click();
  await expect(page.getByRole('heading', { name: /Bucket List/i })).toBeVisible();
  await page.locator('.card-cream .grid button').first().click();
  await page.getByRole('button', { name: /Done —/i }).click();
  await expect(page.getByText(/Route updated ·/)).toBeVisible({ timeout: 15_000 });
});

test('logout returns to landing and login signs back in', async ({ page }) => {
  const email = await signup(page, 'auth');
  await page.getByRole('button', { name: /Log out/i }).click();
  await page.waitForURL((u) => !u.pathname.endsWith('/dashboard'), { timeout: 10_000 });

  await page.goto('/auth');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('heading', { name: /Welcome back/i })).toBeVisible();
  await page.getByPlaceholder('you@example.com').fill(email);
  await page.getByPlaceholder('At least 8 characters').fill('secret123');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.waitForURL(/\/dashboard$/, { timeout: 15_000 });
  await expect(page.getByRole('heading', { name: /Today.s Path/i })).toBeVisible();
});

test('save plan persists and shows up in Profile past trips', async ({ page }) => {
  await signup(page, 'save');
  await expect(page.getByRole('heading', { name: /Today.s Path/i })).toBeVisible();
  await page.getByRole('button', { name: /Save plan/i }).click();
  await expect(page.getByRole('button', { name: /✓ Saved/i })).toBeVisible({ timeout: 10_000 });

  await page.getByRole('link', { name: 'Profile', exact: true }).click();
  await page.waitForURL(/\/profile$/);
  await page.getByRole('button', { name: /Past Trips/i }).click();
  await expect(page.getByText('Saved', { exact: true }).first()).toBeVisible({ timeout: 10_000 });
});

test('tours panel lists, syncs live tours, and sets one as the itinerary', async ({ page }) => {
  await signup(page, 'tours');
  await expect(page.getByRole('heading', { name: /Curated & live tours/i })).toBeVisible();
  await page.getByRole('button', { name: /Sync Live Tours/i }).click();
  await expect(page.getByRole('button', { name: /✓ Synced/i })).toBeVisible({ timeout: 10_000 });
  await page.locator('.bg-surface-2 button', { hasText: /·.*h.*⭐/ }).first().click();
  // "Plan this into my day" was "Set as Today's Itinerary" until the tour panel
  // dropped its dead affiliate link and moved the points award onto this
  // button. Same action, same assertion — only the wording moved.
  await expect(page.getByRole('button', { name: /Plan this into my day/i })).toBeVisible();
  await page.getByRole('button', { name: /Plan this into my day/i }).click();
  await expect(page.getByRole('heading', { name: /Today.s Path/i })).toBeVisible();
  await expect(page.locator('ol li h3').first()).toBeVisible({ timeout: 15_000 });
});

test('split bill adds an item and computes the per-person share', async ({ page }) => {
  await signup(page, 'split');
  await page.getByRole('button', { name: /Split Bill/i }).click();
  await page.getByPlaceholder('Item').fill('Dinner');
  await page.getByPlaceholder('₺').fill('600');
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(page.getByText(/Each person pays/i)).toBeVisible();
  await expect(page.getByText('Dinner')).toBeVisible();
});

test('PDF export opens a print-ready window with the itinerary', async ({ page }) => {
  await signup(page, 'pdf');
  await expect(page.getByRole('heading', { name: /Today.s Path/i })).toBeVisible();
  await page.getByRole('button', { name: /Export/i }).click();
  const [popup] = await Promise.all([
    page.waitForEvent('popup', { timeout: 10_000 }),
    page.getByRole('button', { name: /Export PDF/i }).click(),
  ]);
  await expect(popup.getByText(/Istanbul day plan/i)).toBeVisible({ timeout: 10_000 });
  expect(page.url()).toMatch(/\/dashboard$/);
});

test('journal saves a note for a stop', async ({ page }) => {
  await signup(page, 'journal');
  await expect(page.getByRole('heading', { name: /Today.s Path/i })).toBeVisible();
  await page.getByRole('button', { name: /📸 Journal/i }).first().click();
  await expect(page.getByRole('heading', { name: /Trip Journal/i })).toBeVisible();
  await page.getByPlaceholder(/How was it/i).fill('Great light at golden hour.');
  await page.getByRole('button', { name: /Save to journal/i }).click();
  await expect(page.getByRole('heading', { name: /Trip Journal/i })).toHaveCount(0, { timeout: 10_000 });
});

test('profile tabs render passport badges, visited spots and past trips', async ({ page }) => {
  await signup(page, 'profile');
  await page.getByRole('link', { name: 'Profile', exact: true }).click();
  await page.waitForURL(/\/profile$/);
  await page.getByRole('button', { name: /Passport/i }).click();
  await expect(page.getByText(/%$/).first()).toBeVisible({ timeout: 10_000 });
  await page.getByRole('button', { name: /Visited Spots/i }).click();
  await expect(page.getByText(/Not yet|Visited/i).first()).toBeVisible({ timeout: 10_000 });
  await page.getByRole('button', { name: /Past Trips/i }).click();
  await expect(page.getByText(/stops/i).first()).toBeVisible({ timeout: 10_000 });
});
