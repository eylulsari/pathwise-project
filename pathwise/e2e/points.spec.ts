import { test, expect, type Page } from '@playwright/test';

/**
 * Reward points (Görev 1). Requires the stack running (docker compose up -d).
 *
 * The points economy itself is unit-tested on the backend
 * (`points.service.spec.ts`); these specs cover the wiring the unit tests
 * cannot see — that the balance reaches the profile, and that reserving a tour
 * actually credits the user and says so.
 */

async function signup(page: Page, tag: string) {
  const email = `pts_${tag}_${Date.now()}@std.antalya.edu.tr`;
  await page.goto('/auth');
  await page.getByPlaceholder('Aylin Demir').fill(`${tag} Tester`);
  await page.getByPlaceholder('you@example.com').fill(email);
  await page.getByPlaceholder('At least 8 characters').fill('secret123');
  await page.getByRole('button', { name: /Create account/i }).click();
  await page.waitForURL(/\/dashboard$/, { timeout: 20_000 });
}

const balance = (page: Page) => page.getByTestId('points-balance');

test('a new account starts at zero and is told what points are for', async ({ page }) => {
  await signup(page, 'zero');
  await page.goto('/profile');

  await expect(balance(page)).toContainText('0', { timeout: 15_000 });
  // The card must stay honest about there being nothing to spend them on yet.
  await expect(page.getByText(/What are points for\?/i)).toBeVisible();
  await expect(page.getByText(/Nothing to spend them on just yet/i)).toBeVisible();
});

test('the earn list is rendered from the server price list', async ({ page }) => {
  await signup(page, 'pricelist');
  await page.goto('/profile');
  await expect(balance(page)).toBeVisible({ timeout: 15_000 });

  // Each earning action is listed with the value the backend actually awards.
  const row = (label: RegExp) => page.locator('li').filter({ hasText: label }).first();
  await expect(row(/Reserve a tour or activity/i)).toContainText('+25');
  await expect(row(/Invite a friend who joins/i)).toContainText('+50');
  await expect(row(/Finish a day.s route/i)).toContainText('+30');
  await expect(row(/Review a place you visited/i)).toContainText('+15');
});

test('reserving a tour toasts the award and credits the profile', async ({ page, context }) => {
  await signup(page, 'reserve');

  // Open a tour from the dashboard's tours panel.
  const panel = page.locator('div.rounded-2xl', { hasText: 'Curated & live tours' }).first();
  await expect(panel).toBeVisible({ timeout: 15_000 });
  await panel.getByRole('button').nth(1).click(); // nth(0) is "Sync Live Tours"
  await expect(page.getByRole('heading', { name: /Stops/i })).toBeVisible();

  // The booking link opens the partner site in a new tab; the toast belongs to
  // the page behind it, so swallow the popup and keep asserting on `page`.
  const popup = context.waitForEvent('page').catch(() => null);
  await page.getByRole('link', { name: /Reserve Spot/i }).click();
  await (await popup)?.close();

  // Matched by text, not by role: dnd-kit renders its own empty
  // `role="status"` live region, so the role alone is ambiguous here.
  await expect(page.getByText('+25 points earned')).toBeVisible({ timeout: 15_000 });

  await page.goto('/profile');
  await expect(balance(page)).toContainText('25', { timeout: 15_000 });
  // …and the award is itemised in the ledger, not just added to a counter.
  await expect(
    page.locator('li').filter({ hasText: /Reserve a tour or activity/i }).last(),
  ).toContainText('+25');
});
