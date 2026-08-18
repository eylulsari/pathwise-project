import { test, expect, type Page } from '@playwright/test';

/**
 * Museum Pass savings.
 *
 * The arithmetic is the easy part and is unit-tested. What these check is the
 * honesty of the presentation, because that is what would quietly rot: every
 * entry fee behind this total is an estimate (all five covered places in the
 * dataset are flagged approximate), and the price of the pass itself is not
 * something Pathwise knows. A card that printed a confident "you save X" would
 * be the invented tour prices all over again.
 */

async function signUp(page: Page, tag: string): Promise<void> {
  await page.goto('/auth');
  await page.getByPlaceholder('Aylin Demir').fill('Pass Tester');
  await page
    .getByPlaceholder('you@example.com')
    .fill(`e2e_${tag}_${Date.now()}@std.antalya.edu.tr`);
  await page.getByPlaceholder('At least 8 characters').fill('secret123');
  await page.getByRole('button', { name: /Create account/i }).click();
  await page.waitForURL(/\/dashboard$/, { timeout: 20_000 });
  await expect(page.getByRole('heading', { name: /Today.s Path/i })).toBeVisible();
}

/** Put a pass-covered museum into the day so the card has something to say. */
async function addCoveredStop(page: Page): Promise<void> {
  await page.getByPlaceholder(/Search a place/i).fill('Topkapı');
  await page.getByRole('button', { name: /^Topkapı Palace\b/ }).first().waitFor({
    timeout: 15_000,
  });
  await page.getByRole('button', { name: '➕ Add' }).first().click();
  await expect(page.getByTestId('museum-pass-card')).toBeVisible({ timeout: 20_000 });
}

test('the card lists the covered stops and marks the total as an estimate', async ({
  page,
}) => {
  await signUp(page, 'pass');
  await addCoveredStop(page);

  const card = page.getByTestId('museum-pass-card');
  await expect(card).toContainText(/Topkapı Palace/);

  // The tilde and the word both. A "~" on its own is easy to skim past, and
  // this number is assembled entirely from unverified fees.
  await expect(page.getByTestId('museum-pass-total')).toContainText('~');
  await expect(card).toContainText(/estimated cost of these tickets/i);
  await expect(card).toContainText(/our estimates, not verified prices/i);
});

test('it never claims a net saving, and never quotes the pass price', async ({ page }) => {
  await signUp(page, 'passnet');
  await addCoveredStop(page);

  const card = page.getByTestId('museum-pass-card');

  // Says out loud which half of the sum it is.
  await expect(card).toContainText(/not your saving/i);
  await expect(card).toContainText(/check the current price and subtract/i);

  // And sends the reader to the source for the half we do not have, rather
  // than inventing it.
  const link = card.getByRole('link', { name: /Check the current pass price/i });
  await expect(link).toHaveAttribute('href', /muze\.gov\.tr/);

  // The strongest guard: no sentence in this card may present a figure as a
  // saving the traveller can count on.
  await expect(card).not.toContainText(/you save/i);
});

test('a day with nothing covered shows no card at all', async ({ page }) => {
  // Kadıköy is a food-and-market day — nothing there is on the Museum Pass, so
  // the honest thing is silence rather than a card reading "0 ₺ saved".
  await signUp(page, 'passnone');
  await page.getByRole('button', { name: /Kadıköy & Moda/ }).click();
  await page.getByRole('button', { name: /Generate My Custom Path/i }).click();
  await expect(page.locator('li h3').first()).toBeVisible({ timeout: 25_000 });

  await expect(page.getByTestId('museum-pass-card')).toHaveCount(0);
});
