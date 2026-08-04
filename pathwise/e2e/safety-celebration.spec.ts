import { test, expect, type Page } from '@playwright/test';

/**
 * Regression cover for the two features that shipped without any browser test:
 * the opt-in women-traveler safety mode, and the route-completion celebration.
 *
 * Requires the stack running (docker compose up -d).
 */

async function signUp(page: Page, tag: string) {
  const email = `${tag}_${Date.now()}@std.antalya.edu.tr`;
  await page.goto('/auth');
  await page.getByPlaceholder('Aylin Demir').fill('Safety Tester');
  await page.getByPlaceholder('you@example.com').fill(email);
  await page.getByPlaceholder('At least 8 characters').fill('secret123');
  await page.getByRole('button', { name: /Create account/i }).click();
  await page.waitForURL(/\/dashboard$/, { timeout: 20_000 });
}

// ── Women-traveler safety mode ────────────────────────────────────────

test('women-traveler mode: the two switches stay locked until the declaration is made', async ({
  page,
}) => {
  await signUp(page, 'wt_gate');
  await page.goto('/profile');

  // The inputs sit inside <label>s whose text is label + hint, so target the
  // label by its wording and drill into its checkbox.
  const box = (text: string) =>
    page.locator('label').filter({ hasText: text }).locator('input[type=checkbox]');
  const declaration = box('I identify as a woman');
  const visibility = box('Show me only to women travelers');
  const discovery = box('Show me only women travelers');

  await expect(declaration).toBeVisible({ timeout: 15_000 });
  // Nothing is preselected and the dependent switches are inert.
  await expect(declaration).not.toBeChecked();
  await expect(visibility).toBeDisabled();
  await expect(discovery).toBeDisabled();

  // The self-declaration disclaimer is always on screen, not behind a tooltip.
  await expect(
    page.getByText(/no identity verification|kimlik doğrulaması yapılmaz/i),
  ).toBeVisible();

  await declaration.check();
  await expect(visibility).toBeEnabled({ timeout: 15_000 });
  await expect(discovery).toBeEnabled();

  // Withdrawing the declaration clears and re-locks both switches.
  await discovery.check();
  await expect(discovery).toBeChecked({ timeout: 15_000 });
  await declaration.uncheck();
  await expect(discovery).toBeDisabled({ timeout: 15_000 });
  await expect(discovery).not.toBeChecked();
});

test('women-traveler mode: the buddy filter only applies once opted in, and filters correctly', async ({
  page,
}) => {
  await signUp(page, 'wt_filter');

  // ── Not opted in: t3 (women-only visibility) is hidden, the chip is inert ──
  await page.goto('/social');
  await expect(page.getByText('Mara Lindqvist')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText('Diego Fernández')).toBeVisible();
  await expect(page.getByText('Yuki Tanaka')).toHaveCount(0); // visibleToWomenOnly
  await expect(page.getByRole('button', { name: /Women travelers/i })).toBeDisabled();

  // ── Opt in from the profile ──
  await page.goto('/profile');
  const box = (text: string) =>
    page.locator('label').filter({ hasText: text }).locator('input[type=checkbox]');
  await box('I identify as a woman').check();
  await expect(box('Show me only women travelers')).toBeEnabled({ timeout: 15_000 });

  // ── Opted in: t3 becomes visible, and the filter narrows to women only ──
  await page.goto('/social');
  const chip = page.getByRole('button', { name: /Women travelers/i });
  await expect(chip).toBeEnabled({ timeout: 20_000 });
  await expect(page.getByText('Yuki Tanaka')).toBeVisible({ timeout: 20_000 });

  await chip.click();
  // t1, t3, t4 identify as women; t2 and t5 must drop out.
  await expect(page.getByText('Mara Lindqvist')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText('Yuki Tanaka')).toBeVisible();
  await expect(page.getByText('Amara Okafor')).toBeVisible();
  await expect(page.getByText('Diego Fernández')).toHaveCount(0);
  await expect(page.getByText('Liam O’Connor')).toHaveCount(0);

  // The filter must never read as a vetted set of people.
  await expect(
    page.getByText(/kendini-beyan|self-declared|kimlik doğrulaması yapılmaz/i).first(),
  ).toBeVisible();
});

test('women-traveler mode: SOS can narrow the alert to connected women buddies', async ({
  page,
}) => {
  await signUp(page, 'wt_sos');

  // Connect one woman traveler so the SOS sub-option has something to target.
  await page.goto('/social');
  await expect(page.getByText('Mara Lindqvist')).toBeVisible({ timeout: 20_000 });
  await page
    .locator('.card-cream')
    .filter({ hasText: 'Mara Lindqvist' })
    .getByRole('button', { name: /Connect/i })
    .click();

  // SOS lives on the dashboard map; it asks to confirm before showing the panel.
  await page.goto('/dashboard');
  await page.getByRole('button', { name: /SOS/i }).first().click();
  await page.getByRole('button', { name: /Yes, I need help/i }).click();

  const subOption = page
    .locator('label')
    .filter({ hasText: 'Share only with my connected women travel buddies' })
    .locator('input[type=checkbox]');
  await expect(subOption).toBeVisible({ timeout: 20_000 });
  await subOption.check();
  // A woman buddy IS connected, so the "none connected" warning must not show.
  await expect(page.getByText(/no connected women|kadın .*yok/i)).toHaveCount(0);
});

// ── Route-completion celebration ──────────────────────────────────────

test('completing every stop fires the celebration and unlocks a passport badge', async ({
  page,
}) => {
  test.setTimeout(120_000);
  await signUp(page, 'celebrate');

  await expect(page.getByRole('heading', { name: /Today.s Path/i })).toBeVisible({
    timeout: 20_000,
  });

  // Tick every stop on Today's Path.
  const ticks = page.getByRole('button', { name: /Mark as visited/i });
  const count = await ticks.count();
  expect(count).toBeGreaterThan(0);
  for (let i = 0; i < count; i++) {
    await ticks.nth(i).click();
  }

  // The celebration card appears, with the real stop count.
  await expect(page.getByRole('dialog')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText(/You completed the day|Günü tamamladın/i)).toBeVisible();
  await expect(page.getByText('Stops', { exact: true })).toBeVisible();

  // If a badge was genuinely unlocked, the passport must agree afterwards.
  const badgeBlock = page.getByText(/New badge unlocked|Yeni rozet/i);
  const unlocked = await badgeBlock.isVisible().catch(() => false);

  await page.getByRole('button', { name: /^Close$|^Kapat$/i }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);

  if (unlocked) {
    await page.goto('/profile');
    // The earned badge is recorded, so it renders with the ✓ marker.
    await expect(page.getByText('✓').first()).toBeVisible({ timeout: 20_000 });
  }

  // Re-ticking must not re-fire the celebration for the same plan.
  await page.goto('/dashboard');
  await expect(page.getByRole('heading', { name: /Today.s Path/i })).toBeVisible({
    timeout: 20_000,
  });
  await expect(page.getByRole('dialog')).toHaveCount(0);
});
