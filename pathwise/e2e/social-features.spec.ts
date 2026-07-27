import { test, expect, type Page } from '@playwright/test';

/** Feature regression — social cluster + referral. Runs via `npm run e2e`. */

async function signup(page: Page, tag: string) {
  const email = `soc_${tag}_${Date.now()}@std.antalya.edu.tr`;
  await page.goto('/auth');
  await page.getByPlaceholder('Aylin Demir').fill(`${tag} Tester`);
  await page.getByPlaceholder('you@example.com').fill(email);
  await page.getByPlaceholder('At least 8 characters').fill('secret123');
  await page.getByRole('button', { name: /Create account/i }).click();
  await page.waitForURL(/\/dashboard$/, { timeout: 20_000 });
  return email;
}
async function gotoSocial(page: Page) {
  await page.getByRole('link', { name: 'Social', exact: true }).click();
  await page.waitForURL(/\/social$/);
  await expect(page.getByRole('heading', { name: /Social & Travel Buddies/i })).toBeVisible();
}

test('check-in composer broadcasts a message to the feed', async ({ page }) => {
  await signup(page, 'checkin');
  await gotoSocial(page);
  const msg = `Checking in ${Date.now()}`;
  await page.getByPlaceholder(/say what you.re up to/i).fill(msg);
  await page.getByRole('button', { name: /I.m Here/i }).click();
  await expect(page.getByText(msg)).toBeVisible();
});

test('buddy connect toggles, filter works, and profile modal shows the map', async ({ page }) => {
  await signup(page, 'buddy');
  await gotoSocial(page);
  await page.getByRole('button', { name: /👋 Connect/ }).first().click();
  await expect(page.getByRole('button', { name: /✓ Connected/ }).first()).toBeVisible();
  await page.getByRole('button', { name: '#Foodie', exact: true }).click();
  await page.getByRole('button', { name: /View profile/i }).first().click();
  await expect(page.getByText(/Visited provinces/i)).toBeVisible();
});

test('community route like toggles and clone rebuilds the plan', async ({ page }) => {
  await signup(page, 'routes');
  await gotoSocial(page);
  const like = page.getByRole('button', { name: /🤍|❤️/ }).first();
  await like.click();
  await expect(page.getByRole('button', { name: /❤️/ }).first()).toBeVisible();
  // Clone hands the route's hub to the dashboard and rebuilds Today's Path.
  await page.getByRole('button', { name: /Clone This Route/i }).first().click();
  await page.waitForURL(/\/dashboard$/, { timeout: 10_000 });
  await expect(page.locator('ol li h3').first()).toBeVisible({ timeout: 15_000 });
});

test('forum accepts a quick answer', async ({ page }) => {
  await signup(page, 'forum');
  await gotoSocial(page);
  const ans = page.getByPlaceholder(/Quick answer/i).first();
  const txt = `Answer ${Date.now()}`;
  await ans.fill(txt);
  await ans.press('Enter');
  await expect(page.getByText(txt)).toBeVisible();
});

test('reporting a check-in confirms with a thank-you', async ({ page }) => {
  await signup(page, 'report');
  await gotoSocial(page);
  await page.getByRole('button', { name: /🚩 Report/ }).first().click();
  await page.getByRole('button', { name: 'Spam', exact: true }).click();
  await expect(page.getByText(/✓ Reported/).first()).toBeVisible({ timeout: 10_000 });
});

test('closing a poll and adding the winner injects it into Today’s Path', async ({ page }) => {
  await signup(page, 'pollwin');
  await gotoSocial(page);
  await page.getByRole('button', { name: /Start Poll/i }).first().click();
  const q = `Winner ${Date.now()}?`;
  await page.getByPlaceholder(/Where should we go/i).fill(q);
  const opts = page.getByRole('button', { name: /^☐ / });
  await opts.nth(0).click();
  await opts.nth(1).click();
  await page.getByRole('button', { name: /Create poll/i }).click();

  const card = page.locator('div.rounded-2xl', { hasText: q });
  await expect(card).toBeVisible();
  await card.getByRole('button').filter({ hasText: /· \d+%/ }).first().click();
  await card.getByRole('button', { name: /Close poll/i }).click();
  const winnerRaw = await card.locator('span', { hasText: '🏆' }).textContent();
  const winner = (winnerRaw ?? '').replace('🏆', '').trim();
  expect(winner.length).toBeGreaterThan(0);
  await card.getByRole('button', { name: /Add winner to path/i }).click();
  await page.waitForURL(/\/dashboard$/);
  await expect(page.locator('ol li h3', { hasText: winner })).toBeVisible({ timeout: 15_000 });
});

test('referral code from one user can be redeemed by another', async ({ page }) => {
  await signup(page, 'refA');
  await page.getByRole('link', { name: /Premium/ }).click();
  await page.waitForURL(/\/premium$/);
  const codeA = (await page.locator('code').first().textContent())?.trim() ?? '';
  expect(codeA).toMatch(/^PW/);

  await page.getByRole('button', { name: /Log out/i }).click();
  await page.waitForURL((u) => !u.pathname.endsWith('/premium'), { timeout: 10_000 });

  await signup(page, 'refB');
  await page.getByRole('link', { name: /Premium/ }).click();
  await page.waitForURL(/\/premium$/);
  await page.getByPlaceholder('PWXXXXXX').fill(codeA);
  await page.getByRole('button', { name: 'Redeem', exact: true }).click();
  await expect(page.getByText(/Reward applied/i)).toBeVisible({ timeout: 10_000 });
});
