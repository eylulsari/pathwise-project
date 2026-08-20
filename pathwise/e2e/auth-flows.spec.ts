import { test, expect, type Page } from '@playwright/test';

/**
 * The parts of signing up that are about the person doing it.
 *
 * Before this, the form sent everything to the server and printed whatever
 * came back — so a short password produced "password must be longer than or
 * equal to 8 characters", in English, in an app that speaks six languages. And
 * a new account landed on a dashboard where a route was already generating,
 * with nothing saying what had been decided or by whom.
 */

async function gotoSignIn(page: Page): Promise<void> {
  await page.goto('/auth');
  await page.getByRole('button', { name: /Sign in/i }).first().click();
}

test('the form answers for itself, without asking the server', async ({ page }) => {
  await page.goto('/auth');

  let requests = 0;
  page.on('request', (r) => {
    if (r.url().includes('/auth/register')) requests += 1;
  });

  await page.getByPlaceholder('Aylin Demir').fill('A');
  await page.getByPlaceholder('you@example.com').fill('not-an-address');
  await page.getByPlaceholder('At least 8 characters').fill('short');
  await page.getByRole('button', { name: /Create account/i }).click();

  // Each complaint sits under the field it is about.
  await expect(page.getByTestId('auth-name-error')).toBeVisible();
  await expect(page.getByTestId('auth-email-error')).toBeVisible();
  await expect(page.getByTestId('auth-password-error')).toBeVisible();

  // In a sentence, not a validator's phrasing.
  await expect(page.getByTestId('auth-password-error')).toContainText(/at least 8 characters/i);
  await expect(page.getByTestId('auth-password-error')).not.toContainText(/longer than or equal/i);

  // And nothing was sent: the form knew the answer already.
  expect(requests).toBe(0);
});

test('a complaint waits until you have left the field', async ({ page }) => {
  await page.goto('/auth');
  const password = page.getByPlaceholder('At least 8 characters');

  await password.fill('a');
  // Still typing — no telling-off yet.
  await expect(page.getByTestId('auth-password-error')).toHaveCount(0);

  await password.blur();
  await expect(page.getByTestId('auth-password-error')).toBeVisible();
});

test('a rejected sign-in reads like a sentence, not a status', async ({ page }) => {
  await gotoSignIn(page);
  await page.getByPlaceholder('you@example.com').fill('nobody@std.antalya.edu.tr');
  await page.getByPlaceholder(/characters|Password/i).first().fill('wrong-password-here');
  await page.getByRole('button', { name: /^Sign in$/i }).click();

  const message = page.locator('form p.text-terracotta').first();
  await expect(message).toBeVisible({ timeout: 15_000 });
  await expect(message).toContainText(/do not match/i);
  // The server's own wording must not reach the screen.
  await expect(message).not.toContainText(/invalid credentials/i);
});

test('forgotten password says what is true, and offers a way through', async ({
  page,
}) => {
  await gotoSignIn(page);

  await page.getByTestId('forgot-password').click();
  const note = page.getByTestId('forgot-password-note');
  await expect(note).toBeVisible();

  // It admits the limitation rather than collecting an address and doing
  // nothing with it — there is no provider to send the mail.
  await expect(note).toContainText(/cannot reset passwords by email yet/i);
  await expect(note).toContainText(/write to us/i);

  // And it is not a form: nothing here takes an address and implies a send.
  await expect(note.getByRole('textbox')).toHaveCount(0);
  await expect(note.getByRole('button')).toHaveCount(0);
});

test('a new account is greeted once, and can walk straight past it', async ({ page }) => {
  await page.goto('/auth');
  await page.getByPlaceholder('Aylin Demir').fill('Welcome Tester');
  await page
    .getByPlaceholder('you@example.com')
    .fill(`e2e_welcome_${Date.now()}@std.antalya.edu.tr`);
  await page.getByPlaceholder('At least 8 characters').fill('secret123');
  await page.getByRole('button', { name: /Create account/i }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 20_000 });

  const welcome = page.getByTestId('welcome-modal');
  await expect(welcome).toBeVisible({ timeout: 20_000 });
  await expect(welcome).toContainText(/Pathwise/);

  await page.getByTestId('welcome-start').click();
  await expect(welcome).toHaveCount(0);

  // Gone from the URL too, so a reload does not bring it back — a greeting
  // that reappears is an interruption, not a welcome.
  await expect(page).toHaveURL(/\/dashboard(?!.*welcome)/);
  await page.reload();
  await expect(page.getByRole('heading', { name: /Today.s Path/i })).toBeVisible({
    timeout: 25_000,
  });
  await expect(page.getByTestId('welcome-modal')).toHaveCount(0);
});
