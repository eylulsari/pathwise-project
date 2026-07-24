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
