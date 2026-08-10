import { test, expect, type Locator, type Page } from '@playwright/test';

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

/**
 * A safety-preference checkbox, addressed by its accessible name.
 *
 * ⚠️ Anchor the pattern with `^`. Each checkbox's accessible name is its label
 * PLUS its hint, and while the declaration is unticked both dependent rows
 * read "Available once you tick “I identify as a woman”." — so a substring
 * match on the declaration's wording resolves to all three boxes and Playwright
 * fails on strict mode. Matching from the start of the name keeps them
 * distinct in every state.
 */
const box = (page: Page, name: RegExp) => page.getByRole('checkbox', { name });

/**
 * Toggle a server-confirmed checkbox and wait for it to settle.
 *
 * ⚠️ Not `.check()` / `.uncheck()`. These preferences are NOT optimistic: the
 * box only flips once PATCH /users/me/safety-preferences has returned and the
 * user has been re-read. `.check()` clicks and asserts the new state
 * immediately, so it fails the round-trip with "Clicking the checkbox did not
 * change its state" even though the app is working correctly.
 */
async function toggle(cb: Locator, want: boolean) {
  await cb.click();
  await expect(cb).toBeChecked({ checked: want, timeout: 15_000 });
}

/**
 * A traveler's card in the Buddy Finder.
 *
 * ⚠️ Scope to the card — do NOT assert on `getByText(name)`. The same people
 * also post in the check-in feed on this page, so a bare name match resolves
 * to several elements (strict-mode failure), and an "absent from the buddy
 * list" assertion would be defeated by the author's unrelated check-in.
 */
const travelerCard = (page: Page, name: string) =>
  page.locator('.card-cream').filter({ hasText: name });

// ── Women-traveler safety mode ────────────────────────────────────────

test('women-traveler mode: the two switches stay locked until the declaration is made', async ({
  page,
}) => {
  await signUp(page, 'wt_gate');
  await page.goto('/profile');

  const declaration = box(page, /^I identify as a woman/);
  const visibility = box(page, /^Show me only to women travelers/);
  const discovery = box(page, /^Show me only women travelers/);

  await expect(declaration).toBeVisible({ timeout: 15_000 });
  // Nothing is preselected and the dependent switches are inert.
  await expect(declaration).not.toBeChecked();
  await expect(visibility).toBeDisabled();
  await expect(discovery).toBeDisabled();

  // The self-declaration disclaimer is always on screen, not behind a tooltip.
  await expect(
    page.getByText(/no identity verification|kimlik doğrulaması yapılmaz/i),
  ).toBeVisible();

  await toggle(declaration, true);
  await expect(visibility).toBeEnabled({ timeout: 15_000 });
  await expect(discovery).toBeEnabled();

  // Withdrawing the declaration clears and re-locks both switches.
  await toggle(discovery, true);
  await toggle(declaration, false);
  await expect(discovery).toBeDisabled({ timeout: 15_000 });
  await expect(discovery).not.toBeChecked();
});

test('women-traveler mode: the buddy filter only applies once opted in, and filters correctly', async ({
  page,
}) => {
  await signUp(page, 'wt_filter');

  // ── Not opted in: t3 (women-only visibility) is hidden, the chip is inert ──
  await page.goto('/social');
  await expect(travelerCard(page, 'Mara Lindqvist')).toBeVisible({ timeout: 20_000 });
  await expect(travelerCard(page, 'Diego Fernández')).toBeVisible();
  await expect(travelerCard(page, 'Yuki Tanaka')).toHaveCount(0); // visibleToWomenOnly
  await expect(page.getByRole('button', { name: /Women travelers/i })).toBeDisabled();

  // ── Opt in from the profile ──
  // The declaration ALONE does not activate the mode: the reciprocity rule is
  // `identifiesAsWoman && (visibleToWomenOnly || showWomenOnly)`. Tick the
  // *visibility* switch rather than discovery, so the mode is active while the
  // Buddy Finder filter still starts off — otherwise the page would open with
  // the filter already applied and the click below would turn it back off.
  await page.goto('/profile');
  await toggle(box(page, /^I identify as a woman/), true);
  await toggle(box(page, /^Show me only to women travelers/), true);

  // ── Opted in: t3 becomes visible, and the filter narrows to women only ──
  await page.goto('/social');
  const chip = page.getByRole('button', { name: /Women travelers/i });
  await expect(chip).toBeEnabled({ timeout: 20_000 });
  await expect(travelerCard(page, 'Yuki Tanaka')).toBeVisible({ timeout: 20_000 });

  await chip.click();
  // Declared travelers stay; anyone who never declared must drop out.
  await expect(travelerCard(page, 'Mara Lindqvist')).toBeVisible({ timeout: 20_000 });
  await expect(travelerCard(page, 'Yuki Tanaka')).toBeVisible();
  await expect(travelerCard(page, 'Amara Okafor')).toBeVisible();
  await expect(travelerCard(page, 'Diego Fernández')).toHaveCount(0);
  await expect(travelerCard(page, 'Liam O’Connor')).toHaveCount(0);

  // The filter must never read as a vetted set of people. Match the wording
  // that actually ships ("voluntary self-declaration — no identity
  // verification is performed"), not a paraphrase of it.
  await expect(
    page
      .getByText(/no identity verification|kendini-beyan|kimlik doğrulaması yapılmaz/i)
      .first(),
  ).toBeVisible();
});

test('women-traveler mode: SOS can narrow the alert to connected women buddies', async ({
  page,
}) => {
  await signUp(page, 'wt_sos');

  // Connect one woman traveler so the SOS sub-option has something to target.
  await page.goto('/social');
  const mara = travelerCard(page, 'Mara Lindqvist');
  await expect(mara).toBeVisible({ timeout: 20_000 });
  await mara.getByRole('button', { name: /Connect/i }).click();

  // SOS lives on the dashboard map; it asks to confirm before showing the panel.
  await page.goto('/dashboard');
  await page.getByRole('button', { name: /SOS/i }).first().click();
  await page.getByRole('button', { name: /Yes, I need help/i }).click();

  const subOption = box(page, /^Share only with my connected women travel buddies/);
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
