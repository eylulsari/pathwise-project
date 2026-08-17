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

/**
 * Connection persistence, against a real account.
 *
 * This replaces two specs that connected to a demo profile and reloaded. The
 * shape of the assertion is kept — a thing still on screen after a reload came
 * from the database, not from the tab — but the other side is now a person,
 * which is what makes the row mean anything.
 */
test('a connection request survives a reload, and is nobody else’s', async ({
  page,
  browser,
}) => {
  await signUp(page, 'buddy');

  // The other side has to exist first: a check-in is how one account becomes
  // findable by another.
  const theirContext = await browser.newContext();
  const them = await theirContext.newPage();
  await signUp(them, 'buddy_target');
  const marker = `Persist buddy ${Date.now()}`;
  await them.goto('/social');
  await them.getByPlaceholder(/say what you.re up to/i).fill(marker);
  await them.getByRole('button', { name: /I.m Here/i }).click();
  await expect(them.getByText(marker)).toBeVisible();

  await page.goto('/social');
  const card = page
    .locator('div')
    .filter({ hasText: marker })
    .filter({ has: page.getByRole('button', { name: /Ask to connect/i }) })
    .last();
  await expect(card).toBeVisible({ timeout: 20_000 });
  await card.getByRole('button', { name: /Ask to connect/i }).click();
  await expect(page.getByText(/Request sent/i).first()).toBeVisible();

  // The whole point: a reload re-reads from the server. A request still listed
  // here came out of the database.
  await page.goto('/messages');
  await page.reload();
  await expect(page.getByTestId('dm-connections').getByText(/Persistence Tester/).first())
    .toBeVisible({ timeout: 15_000 });

  // …and it belongs to these two alone. A third, fresh account sees none of it.
  const otherContext = await browser.newContext();
  const other = await otherContext.newPage();
  await signUp(other, 'buddy_other');
  await other.goto('/messages');
  await expect(other.getByTestId('dm-connections').getByRole('button')).toHaveCount(0, {
    timeout: 15_000,
  });

  await otherContext.close();
  await theirContext.close();
});

/**
 * The removed endpoints, asserted at the wire.
 *
 * Taking the button out of the UI is not what makes an action impossible —
 * the request can still be sent by hand. These two used to answer 200 and
 * persist a row pointing at a fixture.
 */
test('the old buddy-connect endpoints are gone, not just hidden', async ({ page, request }) => {
  await signUp(page, 'gone');
  const token = await page.evaluate(() => localStorage.getItem('pathwise.access'));
  expect(token, 'signed-in token').toBeTruthy();
  const headers = { authorization: `Bearer ${token}` };
  const API = process.env.E2E_API_URL ?? 'http://127.0.0.1:3000/api';

  expect((await request.put(`${API}/social/travelers/t1/connect`, { headers })).status()).toBe(404);
  expect((await request.delete(`${API}/social/travelers/t1/connect`, { headers })).status()).toBe(404);

  // And a seed id is still refused by the messaging system it might be aimed
  // at instead — the point is that no path connects an account to a fixture.
  const asked = await request.post(`${API}/messages/connections/t1/request`, { headers });
  expect(asked.ok()).toBeFalsy();
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
