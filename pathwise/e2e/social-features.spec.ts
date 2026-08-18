import { test, expect, type Page } from '@playwright/test';
import { openFromMoreMenu } from './helpers/nav';

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

/**
 * Sample profiles are shown, and are inert.
 *
 * This replaces a test that clicked "👋 Connect" on a demo profile and
 * asserted it flipped to "✓ Connected". That button is gone: it wrote a row
 * linking a real account to a fixture, which nothing could read and nobody was
 * on the other end of. What is worth asserting now is the opposite — that the
 * seed is still there for texture and offers nothing to act on.
 */
test('sample profiles are labelled and offer no connection', async ({ page }) => {
  await signup(page, 'buddy');
  await gotoSocial(page);

  const samples = page.getByTestId('sample-travelers');
  await expect(samples).toBeVisible({ timeout: 20_000 });
  // Said in words, not just implied by a missing button.
  await expect(samples.getByText(/Nobody is behind them/i)).toBeVisible();

  // Not one connect or message affordance anywhere in the section — including
  // inside the profile modal, which used to end with two of them.
  const card = page.getByTestId('sample-card').first();
  await expect(card.getByRole('button', { name: /connect|message/i })).toHaveCount(0);
  await card.getByRole('button', { name: /View profile/i }).click();

  // Scoped to the modal, not the page. The check-in feed behind it carries
  // real accounts with real connect buttons — a page-wide count would be
  // asserting something about other people's cards.
  const modal = page.getByTestId('traveler-modal');
  await expect(modal.getByText(/Visited provinces/i)).toBeVisible();
  await expect(modal.getByRole('button', { name: /connect|message/i })).toHaveCount(0);
  await expect(modal.getByText(/no account behind it/i)).toBeVisible();
});

test('the tag filter narrows the list, and the profile modal opens', async ({ page }) => {
  await signup(page, 'filter');
  await gotoSocial(page);

  const samples = page.getByTestId('sample-travelers');
  // Two named profiles rather than a count: the list arrives asynchronously,
  // so "fewer cards than before" can compare a full list against a partly
  // rendered one and pass or fail on timing. One #Foodie and one not is the
  // same claim, and it settles.
  const card = (name: string) => samples.getByTestId('sample-card').filter({ hasText: name });
  await expect(card('Amara Okafor')).toBeVisible({ timeout: 20_000 }); // #Foodie
  await expect(card('Mara Lindqvist')).toBeVisible(); // not #Foodie

  await page.getByRole('button', { name: '#Foodie', exact: true }).click();
  await expect(card('Amara Okafor')).toBeVisible();
  await expect(card('Mara Lindqvist')).toHaveCount(0);

  // Scoped to the sample section on purpose: real accounts are listed above
  // it and also carry a "View profile" button, so `.first()` on the page can
  // open an account's modal — which has no provinces map, because a real
  // account has no visited-provinces data.
  await samples.getByRole('button', { name: /View profile/i }).first().click();
  await expect(page.getByTestId('traveler-modal').getByText(/Visited provinces/i)).toBeVisible();
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

/**
 * A vote and a close are two writes to the same poll, fired one after the
 * other by a user who votes and then closes straight away. The responses can
 * land in either order, and the test above hit the bad one roughly once every
 * fifty runs: the poll re-opened, the trophy vanished, and "Add winner to
 * path" went with it.
 *
 * Here the order is forced rather than waited for, so this fails every time
 * against the unsequenced version instead of once in fifty.
 */
test('a slow vote response cannot re-open a poll that was already closed', async ({ page }) => {
  await signup(page, 'pollrace');
  await gotoSocial(page);

  // Let the vote reach the server as usual — only its *response* is held, so
  // the server sees the natural order and the client sees the reverse.
  await page.route('**/polls/*/vote', async (route) => {
    const response = await route.fetch();
    await new Promise((resolve) => setTimeout(resolve, 2_000));
    await route.fulfill({ response });
  });

  await page.getByRole('button', { name: /Start Poll/i }).first().click();
  const q = `Race ${Date.now()}?`;
  await page.getByPlaceholder(/Where should we go/i).fill(q);
  const opts = page.getByRole('button', { name: /^☐ / });
  await opts.nth(0).click();
  await opts.nth(1).click();
  await page.getByRole('button', { name: /Create poll/i }).click();

  const card = page.locator('div.rounded-2xl', { hasText: q });
  await expect(card).toBeVisible();

  // Registered before the click, not after: on a slow run the held response
  // could otherwise arrive before anything was listening, and the wait below
  // would sit there until it timed out.
  const voteLanded = page.waitForResponse((r) => /\/polls\/.*\/vote$/.test(r.url()));
  await card.getByRole('button').filter({ hasText: /· \d+%/ }).first().click();
  await card.getByRole('button', { name: /Close poll/i }).click();

  const trophy = card.locator('span', { hasText: '🏆' });
  await expect(trophy).toBeVisible();

  // The late vote response arrives here. Nothing about it may put the poll
  // back: it is older news than the close that has already been applied.
  await voteLanded;
  await expect(trophy).toBeVisible();
  await expect(card.getByRole('button', { name: /Close poll/i })).toHaveCount(0);
  await expect(card.getByRole('button', { name: /Add winner to path/i })).toBeVisible();
});

test.describe('poll list failure', () => {
  /**
   * Without this the test is a coin toss.
   *
   * `page.route` only sees requests issued by the page. Once the PWA service
   * worker is controlling the tab it re-issues them from its own context,
   * where the interception does not apply — so the abort below either lands or
   * is quietly bypassed depending on whether the worker finished activating
   * first. (The same distinction is why the map CSP needed `connect-src`.)
   */
  test.use({ serviceWorkers: 'block' });

  test('a poll list that cannot be loaded says so, rather than "no polls yet"', async ({
    page,
  }) => {
    await signup(page, 'pollfail');
    // Only the list request. A vote or a close is a different path and must
    // keep working, or this would prove nothing about the list specifically.
    await page.route('**/polls', (route) =>
      route.request().method() === 'GET' ? route.abort() : route.continue(),
    );
    await gotoSocial(page);

    await expect(page.getByText(/Could not load the polls/i)).toBeVisible();
    await expect(page.getByText(/No polls yet/i)).toHaveCount(0);
  });
});

test('referral code from one user can be redeemed by another', async ({ page }) => {
  await signup(page, 'refA');
  await openFromMoreMenu(page, /Premium/);
  await page.waitForURL(/\/premium$/);
  const codeA = (await page.locator('code').first().textContent())?.trim() ?? '';
  expect(codeA).toMatch(/^PW/);

  await page.getByRole('button', { name: /Log out/i }).click();
  await page.waitForURL((u) => !u.pathname.endsWith('/premium'), { timeout: 10_000 });

  await signup(page, 'refB');
  await openFromMoreMenu(page, /Premium/);
  await page.waitForURL(/\/premium$/);
  await page.getByPlaceholder('PWXXXXXX').fill(codeA);
  await page.getByRole('button', { name: 'Redeem', exact: true }).click();
  await expect(page.getByText(/Reward applied/i)).toBeVisible({ timeout: 10_000 });
});
