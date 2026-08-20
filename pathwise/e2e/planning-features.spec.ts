import { test, expect, type Page } from '@playwright/test';
import { dismissWelcome } from './helpers/welcome';

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
  await dismissWelcome(page);
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

test('Vibe Quiz walks all seven steps and rebuilds the route', async ({ page }) => {
  await signup(page, 'quiz');
  await expect(page.getByRole('heading', { name: /Today.s Path/i })).toBeVisible();
  await page.getByRole('button', { name: /Vibe Quiz/i }).click();
  await expect(page.getByText(/What's your mood/i)).toBeVisible();

  // One answer per question, in order. Next stays disabled until each is
  // answered, so a step that failed to render would stall here rather than
  // being skipped past.
  const answer = async (label: string | RegExp) => {
    await page.getByRole('button', { name: label }).click();
    await page.getByRole('button', { name: /Next/i }).click();
  };
  await answer('History Buff');
  await answer('Relaxed');
  await answer('Family with kids');
  await answer('Short distances');
  await answer('First time');
  await answer('Vegetarian');

  await page.getByRole('button', { name: /Build my path/i }).click();
  await expect(page.getByText(/What's your mood/i)).toHaveCount(0);
  await expect(page.locator('ol li h3').first()).toBeVisible({ timeout: 15_000 });

  // The party answer is the one that has somewhere visible to land: it becomes
  // the day's group, so the generator form must now agree with the quiz rather
  // than still showing whatever it held before.
  await expect(
    page.getByRole('button', { name: /Family/ }).first(),
  ).toHaveClass(/border-iznik/);
});

test('the dietary question says it does not filter the route', async ({ page }) => {
  await signup(page, 'diet');
  await page.getByRole('button', { name: /Vibe Quiz/i }).click();
  // Scoped to the modal: every choice carries an emoji in its accessible name,
  // and "Solo" also names a button on the generator form behind the overlay.
  const quiz = page.locator('.card-cream');
  for (const label of ['History Buff', 'Relaxed', 'Solo', 'Average', 'First time']) {
    await quiz.getByRole('button', { name: label }).click();
    await quiz.getByRole('button', { name: /Next/i }).click();
  }
  await expect(page.getByText(/Any dietary restrictions/i)).toBeVisible();
  // The honesty note is the feature here. Nothing in the catalogue records
  // whether a kitchen can feed a vegan, so the app says what it does with the
  // answer instead of implying a filter it cannot perform.
  await expect(page.getByText(/does not filter your route/i)).toBeVisible();
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

/*
 * The dashboard tours panel used to be covered here — it listed, "synced live
 * tours" and set one as the day. It is gone: the tours it listed were
 * invented, with made-up prices and ratings and `.mock` booking links, and
 * two of them were attributed to GetYourGuide and TripAdvisor by name. There
 * is nothing left to assert about it, and the surface that replaced it is
 * covered in tours-blog.spec.ts against the real referral links.
 */

test('a trip can be stretched to seven days, each on its own neighborhood', async ({
  page,
}) => {
  // New accounts start on a Premium trial, so the trip-length selector is
  // available immediately. The dashboard shipped three hardcoded days for its
  // whole life — this is the spec that would have caught that.
  await signup(page, 'triplen');
  await expect(page.getByRole('heading', { name: /Today.s Path/i })).toBeVisible({
    timeout: 20_000,
  });
  await expect(page.getByRole('button', { name: /^Day 3$/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Day 7$/ })).toHaveCount(0);

  await page.getByLabel(/Trip length/i).selectOption('7');

  // Seven tabs, and every one of them reachable.
  for (const n of [1, 2, 3, 4, 5, 6, 7]) {
    await expect(page.getByRole('button', { name: new RegExp(`^Day ${n}$`) })).toBeVisible({
      timeout: 15_000,
    });
  }

  // Day 7 generates a real plan rather than sitting empty — the failure mode
  // when a hub runs out of places is a blank tab, not an error.
  await page.getByRole('button', { name: /^Day 7$/ }).click();
  await expect(page.locator('ol li h3').first()).toBeVisible({ timeout: 20_000 });

  // Shrinking drops the tail back off.
  await page.getByLabel(/Trip length/i).selectOption('2');
  await expect(page.getByRole('button', { name: /^Day 3$/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^Day 2$/ })).toBeVisible();
});

// (The Split Bill test lived here. It drove a modal that kept its items in
// component state, opened pre-loaded with an invented ₺420 lunch, and divided
// by a headcount with no notion of who paid — so the one number it asserted
// was an equal share of a bill nobody had entered. That modal is now a
// persisted ledger; see expenses.spec.ts, which covers recording, reload
// persistence, the budget comparison, the settlement, and the rule that no
// endpoint here moves money.)

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
