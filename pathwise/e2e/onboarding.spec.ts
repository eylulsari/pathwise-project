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
