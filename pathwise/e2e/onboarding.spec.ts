import { test, expect } from '@playwright/test';

/**
 * Full-stack smoke test: real browser drives onboarding → dashboard, then
 * asserts the interactive map and Today's Path actually render with data.
 * Requires the stack running (docker compose up -d).
 */
test('sign up, land on dashboard, map and Today’s Path render', async ({ page }) => {
  const email = `e2e_${Date.now()}@std.antalya.edu.tr`;

  // ── Landing ──
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Plan Istanbul/i })).toBeVisible();
  await page.getByRole('link', { name: /Sign in to start planning/i }).click();

  // ── Sign up ──
  await expect(page).toHaveURL(/\/auth$/);
  await page.getByPlaceholder('Aylin Demir').fill('E2E Tester');
  await page.getByPlaceholder('you@example.com').fill(email);
  await page.getByPlaceholder('At least 8 characters').fill('secret123');
  await page.getByRole('button', { name: /Create account/i }).click();

  // ── Success → Dashboard (auto-redirect) ──
  await page.waitForURL(/\/dashboard$/, { timeout: 15_000 });

  // Today's Path renders with real stops from the backend engine.
  await expect(page.getByRole('heading', { name: /Today.s Path/i })).toBeVisible();
  await expect(page.getByText('Daily budget', { exact: true })).toBeVisible();
  // At least one real stop with its "Read Local Story" action.
  await expect(page.getByRole('button', { name: /Read Local Story/i }).first()).toBeVisible();

  // The interactive Leaflet map mounts and has numbered pins.
  await expect(page.locator('.leaflet-container')).toBeVisible();
  await expect(page.locator('.leaflet-marker-icon').first()).toBeVisible();
  const pinCount = await page.locator('.leaflet-marker-icon').count();
  expect(pinCount).toBeGreaterThan(0);

  // A route line is drawn between stops (real OSRM geometry or fallback).
  await expect(page.locator('.leaflet-overlay-pane path').first()).toBeVisible();

  // The route generator controls are present.
  await expect(page.getByRole('button', { name: /Generate My Custom Path/i })).toBeVisible();
});

test('can open the Travel Vibe Quiz from the dashboard', async ({ page }) => {
  const email = `e2e_quiz_${Date.now()}@std.antalya.edu.tr`;
  await page.goto('/auth');
  await page.getByPlaceholder('Aylin Demir').fill('Quiz Tester');
  await page.getByPlaceholder('you@example.com').fill(email);
  await page.getByPlaceholder('At least 8 characters').fill('secret123');
  await page.getByRole('button', { name: /Create account/i }).click();
  await page.waitForURL(/\/dashboard$/, { timeout: 15_000 });

  await page.getByRole('button', { name: /Vibe Quiz/i }).click();
  await expect(page.getByRole('heading', { name: /Travel Vibe Quiz/i })).toBeVisible();
  await expect(page.getByText(/What's your mood/i)).toBeVisible();
});

test('drag-and-drop reorders Today’s Path and an End point selector exists', async ({ page }) => {
  const email = `e2e_dnd_${Date.now()}@std.antalya.edu.tr`;
  await page.goto('/auth');
  await page.getByPlaceholder('Aylin Demir').fill('DnD Tester');
  await page.getByPlaceholder('you@example.com').fill(email);
  await page.getByPlaceholder('At least 8 characters').fill('secret123');
  await page.getByRole('button', { name: /Create account/i }).click();
  await page.waitForURL(/\/dashboard$/, { timeout: 15_000 });

  // End point selector (Phase 2) is present with an Auto option.
  await expect(page.getByRole('heading', { name: 'End point' })).toBeVisible();

  // Wait for at least two stops.
  const names = page.locator('ol li h3');
  await expect(names.nth(1)).toBeVisible();
  const before = await names.allTextContents();
  expect(before.length).toBeGreaterThan(1);

  // Drag stop #1's handle below stop #2 (dnd-kit needs stepped pointer moves).
  const handles = page.getByRole('button', { name: 'Drag to reorder' });
  const h0 = await handles.nth(0).boundingBox();
  const row1 = await page.locator('ol li').nth(1).boundingBox();
  if (h0 && row1) {
    await page.mouse.move(h0.x + h0.width / 2, h0.y + h0.height / 2);
    await page.mouse.down();
    await page.mouse.move(h0.x + h0.width / 2, h0.y + h0.height / 2 + 12, { steps: 5 });
    await page.mouse.move(row1.x + row1.width / 2, row1.y + row1.height + 20, { steps: 12 });
    await page.mouse.up();
  }

  // Order recomputed → the first stop is no longer the same.
  await expect
    .poll(async () => (await names.allTextContents())[0], { timeout: 10_000 })
    .not.toBe(before[0]);
});

test('can pin a reservation and see a nearby suggestion', async ({ page }) => {
  const email = `e2e_res_${Date.now()}@std.antalya.edu.tr`;
  await page.goto('/auth');
  await page.getByPlaceholder('Aylin Demir').fill('Res Tester');
  await page.getByPlaceholder('you@example.com').fill(email);
  await page.getByPlaceholder('At least 8 characters').fill('secret123');
  await page.getByRole('button', { name: /Create account/i }).click();
  await page.waitForURL(/\/dashboard$/, { timeout: 15_000 });
  await expect(page.getByRole('heading', { name: /Today.s Path/i })).toBeVisible();

  // Lower the pace (2nd range = pace) and regenerate so the hub isn't
  // saturated → a nearby "add this too" suggestion becomes available.
  await page.locator('input[type=range]').nth(1).fill('2');
  await page.getByRole('button', { name: /Generate My Custom Path/i }).click();
  await expect(page.getByText(/Nearby:/i)).toBeVisible({ timeout: 12_000 });

  // Pin a reservation on the first stop.
  await page.getByRole('button', { name: /^📎 Reserve$/ }).first().click();
  await expect(page.getByRole('heading', { name: /Add reservation/i })).toBeVisible();
  await page.getByRole('button', { name: /Save reservation/i }).click();

  // A 📎 time badge appears on a stop after the day re-times around it.
  await expect(page.locator('text=/📎 \\d{2}:\\d{2}/').first()).toBeVisible({ timeout: 10_000 });
});

test('free plan locks Day 2 and upgrading to Premium unlocks it', async ({ page }) => {
  const email = `e2e_prem_${Date.now()}@std.antalya.edu.tr`;
  await page.goto('/auth');
  await page.getByPlaceholder('Aylin Demir').fill('Prem Tester');
  await page.getByPlaceholder('you@example.com').fill(email);
  await page.getByPlaceholder('At least 8 characters').fill('secret123');
  await page.getByRole('button', { name: /Create account/i }).click();
  await page.waitForURL(/\/dashboard$/, { timeout: 15_000 });

  // Free: Day 2 is locked and an optimize counter is shown.
  await expect(page.getByRole('button', { name: /🔒 Day 2/ })).toBeVisible();
  await expect(page.getByText(/optimizations left today/i)).toBeVisible();

  // Go to Premium and upgrade.
  await page.getByRole('link', { name: /Premium/ }).click();
  await expect(page).toHaveURL(/\/premium$/);
  await expect(page.getByRole('button', { name: /Upgrade to Premium/i })).toBeVisible();
  await page.getByRole('button', { name: /Upgrade to Premium/i }).click();
  // After upgrade the button flips to downgrade.
  await expect(page.getByRole('button', { name: /Switch to Free/i })).toBeVisible({ timeout: 10_000 });

  // Back on the dashboard Day 2 is unlocked (no lock icon) + unlimited shown.
  await page.getByRole('link', { name: 'Plan', exact: true }).click();
  await page.waitForURL(/\/dashboard$/);
  await expect(page.getByRole('button', { name: /🔒 Day 2/ })).toHaveCount(0);
  await expect(page.getByText(/Unlimited/i)).toBeVisible();
});

test('language toggle switches the UI between English and Turkish', async ({ page }) => {
  await page.goto('/');
  // Defaults to English (Playwright locale is en-US).
  await expect(page.getByRole('link', { name: 'Sign In', exact: true })).toBeVisible();

  // Switch to Turkish via the header toggle.
  await page.getByRole('button', { name: 'TR', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Giriş Yap', exact: true })).toBeVisible();
  await expect(page.getByText(/akıllı & sosyal/i)).toBeVisible();

  // Switch back to English.
  await page.getByRole('button', { name: 'EN', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Sign In', exact: true })).toBeVisible();
});
