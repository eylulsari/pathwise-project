import { test, expect, type Page } from '@playwright/test';
import { dismissWelcome } from './helpers/welcome';

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
  await dismissWelcome(page);
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
  await expect(row(/Open a tour on GetYourGuide/i)).toContainText('+25');
  await expect(row(/Invite a friend who joins/i)).toContainText('+50');
  await expect(row(/Finish a day.s route/i)).toContainText('+30');
  await expect(row(/Review a place you visited/i)).toContainText('+15');
});

test('opening a tour on GetYourGuide toasts the award and credits the profile', async ({
  page,
  context,
}) => {
  await signup(page, 'reserve');

  /*
   * The award moved with the feature.
   *
   * It was granted from the dashboard tours panel, which is gone — the tours
   * there were invented and their booking links were `.mock` placeholders.
   * `tour_reserved` is defined as "booked a tour/activity through a partner
   * link", and /tours is where the partner links are real, so that is where
   * it is earned now.
   */
  await page.goto('/tours');
  await expect(page.getByTestId('tour-card').first()).toBeVisible({ timeout: 15_000 });

  // The link opens GetYourGuide in a new tab. Let it, then close it — the
  // toast has to survive on the page behind, which is the point of showing it
  // there rather than mid-navigation.
  const opened = context.waitForEvent('page');
  await page.getByTestId('tour-card').first().getByRole('link').click();
  await (await opened).close();

  // Matched by text, not by role: dnd-kit renders its own empty
  // `role="status"` live region, so the role alone is ambiguous here.
  await expect(page.getByText('+25 points earned')).toBeVisible({ timeout: 15_000 });

  await page.goto('/profile');
  await expect(balance(page)).toContainText('25', { timeout: 15_000 });
  // …and the award is itemised in the ledger, not just added to a counter.
  await expect(
    page.locator('li').filter({ hasText: /Open a tour on GetYourGuide/i }).last(),
  ).toContainText('+25');
});
