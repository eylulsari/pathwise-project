import { test, expect, type Page } from '@playwright/test';
import { dismissWelcome } from './helpers/welcome';

/**
 * Sharing a plan with somebody who is not you.
 *
 * The claim worth testing is the awkward one: that the link works for a
 * stranger. There is no share endpoint — `/api/plan` is behind JwtAuthGuard
 * and reads its user id from the auth context, so a copied dashboard URL
 * would show the recipient their own plan or the sign-in screen. The link
 * therefore carries the summary in its fragment, and the second test opens it
 * in a browser context with no session at all, which is the only way to prove
 * the difference.
 */

async function signUp(page: Page, tag: string): Promise<void> {
  await page.goto('/auth');
  await page.getByPlaceholder('Aylin Demir').fill('Share Tester');
  await page
    .getByPlaceholder('you@example.com')
    .fill(`e2e_${tag}_${Date.now()}@std.antalya.edu.tr`);
  await page.getByPlaceholder('At least 8 characters').fill('secret123');
  await page.getByRole('button', { name: /Create account/i }).click();
  await page.waitForURL(/\/dashboard$/, { timeout: 20_000 });
  await dismissWelcome(page);
  await expect(page.getByRole('heading', { name: /Today.s Path/i })).toBeVisible({
    timeout: 25_000,
  });
}

test('the sheet shows the summary it is about to copy, and copies it', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await signUp(page, 'share');

  await page.getByTestId('open-share').click();
  await expect(page.getByTestId('share-sheet')).toBeVisible();

  // The text is on screen before it is anywhere else — a copy button that
  // reveals nothing asks to be trusted before it has earned it.
  const summary = await page.getByTestId('share-summary').inputValue();
  expect(summary).toContain('Pathwise');
  expect(summary).toMatch(/Day 1/);
  expect(summary).toMatch(/Budget: ₺[\d.,]+ of ₺[\d.,]+/);
  expect(summary).toMatch(/Walking: [\d.]+ km/);
  // Real stop names, at real times — not a template with the plan left out.
  expect(summary).toMatch(/\d{2}:\d{2}\s{2}\S/);

  await page.getByTestId('share-copy-summary').click();
  await expect(page.getByTestId('share-status')).toContainText(/Summary copied/i);

  const clipboard = await page.evaluate(() => navigator.clipboard.readText());
  // What was promised is what landed. Line endings are normalised because the
  // Windows clipboard stores CRLF whatever it was handed — that is the
  // platform's doing, and asserting on it would make this test pass or fail
  // by operating system rather than by behaviour.
  const sameText = (s: string) => s.replace(/
/g, '
');
  expect(sameText(clipboard)).toBe(sameText(summary));
});

test('the copied link opens the plan for someone with no account', async ({
  page,
  context,
  browser,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await signUp(page, 'sharelink');

  await page.getByTestId('open-share').click();
  const summary = await page.getByTestId('share-summary').inputValue();
  await page.getByTestId('share-copy-link').click();
  await expect(page.getByTestId('share-status')).toContainText(/Link copied/i);

  const link = await page.evaluate(() => navigator.clipboard.readText());
  expect(link).toContain('/s#');

  // A brand new context: no cookies, no tokens, nobody signed in. This is the
  // friend on the other end of the message.
  const stranger = await browser.newContext();
  const theirPage = await stranger.newPage();
  await theirPage.goto(link);

  await expect(theirPage.getByTestId('shared-summary')).toBeVisible({ timeout: 15_000 });
  await expect(theirPage.getByTestId('shared-summary')).toHaveText(summary);
  // Read-only, and it offers them the thing they would actually want next.
  await expect(theirPage.getByTestId('shared-cta')).toBeVisible();
  await theirPage.getByTestId('shared-cta').click();
  await expect(theirPage).toHaveURL(/\/auth$/);

  await stranger.close();
});

test('a link that arrived broken says so, instead of showing an empty plan', async ({
  page,
}) => {
  // Chat apps trim long URLs, and a truncated fragment decodes to nothing.
  // Rendering that as a blank itinerary would look like a plan with no stops.
  await page.goto('/s#not-a-real-payload');
  await expect(page.getByTestId('shared-empty')).toBeVisible();
  await expect(page.getByTestId('shared-empty')).toContainText(/cut short|empty/i);
  await expect(page.getByTestId('shared-summary')).toHaveCount(0);

  await page.goto('/s');
  await expect(page.getByTestId('shared-empty')).toBeVisible();
});
