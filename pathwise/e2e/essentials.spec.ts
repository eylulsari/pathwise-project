import { test, expect, Page } from '@playwright/test';
import { openFromMoreMenu } from './helpers/nav';

/**
 * The Essentials page, and the mosque etiquette that also appears on a mosque's
 * own detail panel.
 *
 * The content is static, so these assert the strings a traveller would act on
 * rather than merely that a page rendered — an Essentials page that loads and
 * shows nothing useful passes a "is it visible" check perfectly well.
 */

async function signUp(page: Page, tag: string): Promise<void> {
  await page.goto('/auth');
  await page.getByPlaceholder('Aylin Demir').fill('Essentials Tester');
  await page
    .getByPlaceholder('you@example.com')
    .fill(`e2e_${tag}_${Date.now()}@std.antalya.edu.tr`);
  await page.getByPlaceholder('At least 8 characters').fill('secret123');
  await page.getByRole('button', { name: /Create account/i }).click();
  await page.waitForURL(/\/dashboard$/, { timeout: 20_000 });
}

test('Essentials is reachable from the nav and carries all five sections', async ({
  page,
}) => {
  await signUp(page, 'ess');

  await openFromMoreMenu(page, /Essentials/);
  await expect(page).toHaveURL(/\/essentials$/);
  await expect(page.getByRole('heading', { name: /^Essentials$/ })).toBeVisible();

  const list = page.getByTestId('essentials-list');
  for (const heading of [
    /Emergency/i,
    /Visiting a mosque/i,
    /Tipping/i,
    /Things to watch for/i,
    /Practical/i,
  ]) {
    await expect(list.getByRole('heading', { name: heading })).toBeVisible();
  }

  // The emergency number is the one item somebody might read in a hurry, so
  // assert the number itself rather than the card around it.
  await expect(list).toContainText('112');
  await expect(list).toContainText(/police, ambulance, fire/i);
  // One line from each remaining section, so a card that renders its heading
  // with an empty body still fails.
  await expect(list).toContainText(/Shoes come off/i);
  await expect(list).toContainText(/rounding the fare up/i);
  await expect(list).toContainText(/taxi meter is running/i);
  await expect(list).toContainText(/İstanbulkart/i);
});

test('the page translates with the language toggle', async ({ page }) => {
  await signUp(page, 'esstr');
  await page.goto('/essentials');
  await expect(page.getByRole('heading', { name: /^Essentials$/ })).toBeVisible();

  await page.getByRole('button', { name: /TR/i }).first().click();
  await expect(page.getByRole('heading', { name: /Temel Bilgiler/ })).toBeVisible();
  await expect(page.getByTestId('essentials-list')).toContainText(/Ayakkabı çıkarılır/);
});

test('a mosque shows the etiquette on its own detail panel, and a café does not', async ({
  page,
}) => {
  await signUp(page, 'mosque');

  // Force a mosque into the day, then open its story.
  await page.getByPlaceholder(/Search a place/i).fill('Blue Mosque');
  await expect(page.getByRole('button', { name: /^Blue Mosque\b/ })).toBeVisible({
    timeout: 10_000,
  });
  await page.getByRole('button', { name: '➕ Add' }).first().click();

  const row = page
    .locator('ol li')
    .filter({ has: page.locator('h3', { hasText: 'Blue Mosque' }) });
  await expect(row).toBeVisible({ timeout: 15_000 });
  await row.getByRole('button', { name: /Read Local Story/i }).click();

  const etiquette = page.getByTestId('mosque-etiquette');
  await expect(etiquette).toBeVisible();
  // Same four lines as the Essentials page — they read the same keys, and this
  // is what would catch them drifting into two wordings.
  await expect(etiquette).toContainText(/Shoes come off/i);
  await expect(etiquette).toContainText(/headscarf/i);

  await page.getByRole('button', { name: '✕' }).first().click();

  // A stop that is not a mosque must not carry it. Without this the box could
  // be rendered unconditionally and every assertion above would still pass.
  const other = page
    .locator('ol li')
    .filter({ has: page.getByRole('button', { name: /Read Local Story/i }) })
    .filter({ hasNot: page.locator('h3', { hasText: 'Mosque' }) })
    .filter({ hasNot: page.locator('h3', { hasText: 'Camii' }) })
    .first();
  await other.getByRole('button', { name: /Read Local Story/i }).click();
  await expect(page.getByRole('heading', { name: /The story/i })).toBeVisible();
  await expect(page.getByTestId('mosque-etiquette')).toHaveCount(0);
});
