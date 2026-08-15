import { test, expect, type Page } from '@playwright/test';

/**
 * Forum answers and route likes, now that both are persisted.
 *
 * Each spec **reloads the page** before asserting: a value still on screen
 * after a reload came back from the database, which is the only thing that
 * distinguishes this from the client-only behaviour these features had before.
 *
 * ⚠️ These surfaces are SHARED — every account sees the same threads and the
 * same like totals. So nothing here asserts a global count or "is first";
 * assertions are about *this* user's own contribution and the deltas it
 * causes. Specs also touch different threads and routes from the ones in
 * social-features.spec.ts, so parallel workers cannot collide.
 *
 * Requires the stack running (docker compose up -d).
 */

async function signUp(page: Page, tag: string) {
  const email = `sp_${tag}_${Date.now()}@std.antalya.edu.tr`;
  await page.goto('/auth');
  await page.getByPlaceholder('Aylin Demir').fill('Persistence Tester');
  await page.getByPlaceholder('you@example.com').fill(email);
  await page.getByPlaceholder('At least 8 characters').fill('secret123');
  await page.getByRole('button', { name: /Create account/i }).click();
  await page.waitForURL(/\/dashboard$/, { timeout: 20_000 });
}

// A thread the other specs do not touch (they use the first one).
const THREAD = /Best time of day to photograph Balat/i;
// Likewise a route: social-features.spec.ts likes whichever is first.
const ROUTE = 'Ortaköy to Bebek waterfront';

const thread = (page: Page) =>
  page.getByTestId('forum-thread').filter({ hasText: THREAD });
const routeCard = (page: Page) =>
  page.locator('div.rounded-2xl').filter({ hasText: ROUTE }).first();

/** The like button's count, read off the card. */
async function likeCount(page: Page): Promise<number> {
  const text = await routeCard(page).getByRole('button', { name: /🤍|❤️/ }).textContent();
  return Number((text ?? '').replace(/\D/g, ''));
}

test('a buddy connection survives a reload, and is nobody else’s', async ({ page, browser }) => {
  await signUp(page, 'buddy');
  await page.goto('/social');

  // Connect to whoever is first. Which traveler that is does not matter —
  // the list is ranked per account, and what is being proved is that the
  // connection outlives the tab, not who it was with.
  const connectButton = page.getByRole('button', { name: /👋 Connect/ }).first();
  await expect(connectButton).toBeVisible({ timeout: 15_000 });
  await connectButton.click();
  await expect(page.getByRole('button', { name: /✓ Connected/ }).first()).toBeVisible();

  // The whole point: a reload re-reads the list from the server. A connection
  // still showing here came out of the database, not out of this tab.
  await page.reload();
  await expect(page.getByRole('button', { name: /✓ Connected/ }).first()).toBeVisible({
    timeout: 15_000,
  });

  // …and it belongs to this account alone. A second, fresh account must see
  // the same people with nobody connected.
  const otherContext = await browser.newContext();
  const other = await otherContext.newPage();
  await signUp(other, 'buddy_other');
  await other.goto('/social');
  await expect(other.getByRole('button', { name: /👋 Connect/ }).first()).toBeVisible({
    timeout: 15_000,
  });
  await expect(other.getByRole('button', { name: /✓ Connected/ })).toHaveCount(0);
  await otherContext.close();
});

test('disconnecting survives a reload too', async ({ page }) => {
  await signUp(page, 'unbuddy');
  await page.goto('/social');

  await page.getByRole('button', { name: /👋 Connect/ }).first().click();
  const connected = page.getByRole('button', { name: /✓ Connected/ }).first();
  await expect(connected).toBeVisible({ timeout: 15_000 });

  await connected.click();
  await page.reload();
  // Nothing connected after the round trip — the delete reached the database.
  await expect(page.getByRole('button', { name: /✓ Connected/ })).toHaveCount(0, {
    timeout: 15_000,
  });
});

test('a forum answer survives a reload, in its own thread', async ({ page }) => {
  await signUp(page, 'forum');
  await page.goto('/social');

  const target = thread(page);
  await expect(target).toBeVisible({ timeout: 20_000 });

  // A seed answer, to prove the curated ones are merged rather than replaced.
  const SEED_ANSWER = /Before 09:00 on a weekday/i;
  await expect(target.getByText(SEED_ANSWER)).toBeVisible();

  const answer = `answered at ${Date.now()}`;
  await target.getByPlaceholder(/Quick answer/i).fill(answer);
  await target.getByPlaceholder(/Quick answer/i).press('Enter');
  await expect(target.getByText(answer)).toBeVisible({ timeout: 15_000 });

  // Reload: nothing survives in memory, so anything here came from the DB.
  await page.reload();
  await expect(thread(page)).toBeVisible({ timeout: 20_000 });
  await expect(thread(page).getByText(answer)).toBeVisible({ timeout: 15_000 });

  // …in the right thread, and not leaked into any other one.
  const others = page.getByTestId('forum-thread').filter({ hasNotText: THREAD });
  await expect(others.getByText(answer)).toHaveCount(0);

  // …and the seed answers are still beside it.
  await expect(thread(page).getByText(SEED_ANSWER)).toBeVisible();
});

test('a like persists, is idempotent, and can be taken back', async ({ page }) => {
  await signUp(page, 'like');
  await page.goto('/social');

  const card = routeCard(page);
  await expect(card).toBeVisible({ timeout: 20_000 });

  const before = await likeCount(page);
  const button = () => routeCard(page).getByRole('button', { name: /🤍|❤️/ });
  await expect(button()).toHaveText(/🤍/); // not liked yet

  // ── Like, and reload ──
  await button().click();
  await expect(button()).toHaveText(/❤️/, { timeout: 15_000 });
  await expect.poll(() => likeCount(page), { timeout: 15_000 }).toBe(before + 1);

  await page.reload();
  await expect(routeCard(page)).toBeVisible({ timeout: 20_000 });
  await expect(button()).toHaveText(/❤️/, { timeout: 15_000 });
  expect(await likeCount(page)).toBe(before + 1);

  // ── Liking again must not add a second like ──
  //
  // The UI toggles, so re-clicking would unlike. Hit the API directly instead:
  // this is exactly the idempotency the UNIQUE(userId, routeId) constraint
  // buys, and it is what a retry or a double-fire would do.
  const api = process.env.E2E_API_URL ?? 'http://localhost:3000/api';
  const repeat = await page.evaluate(
    async ([base]) => {
      const token = localStorage.getItem('pathwise.access');
      const res = await fetch(`${base}/social/community-routes/r10/like`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
        credentials: 'include',
      });
      return (await res.json()) as { likes: number; liked: boolean };
    },
    [api],
  );
  expect(repeat.liked).toBe(true);
  expect(repeat.likes).toBe(before + 1); // unchanged — one like per person

  // ── Take it back, and reload ──
  await page.reload();
  await expect(routeCard(page)).toBeVisible({ timeout: 20_000 });
  await button().click();
  await expect(button()).toHaveText(/🤍/, { timeout: 15_000 });

  await page.reload();
  await expect(routeCard(page)).toBeVisible({ timeout: 20_000 });
  await expect(button()).toHaveText(/🤍/, { timeout: 15_000 });
  expect(await likeCount(page)).toBe(before);
});
