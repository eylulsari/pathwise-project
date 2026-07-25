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

  // A1: an "Route updated / Undo" banner appears; Undo restores the order.
  await expect(page.getByText(/Route updated/i)).toBeVisible();
  await page.getByRole('button', { name: /Undo/i }).click();
  await expect
    .poll(async () => (await names.allTextContents())[0], { timeout: 10_000 })
    .toBe(before[0]);
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

test('trial→free locks Day 2, and upgrading to Premium unlocks it', async ({ page }) => {
  const email = `e2e_prem_${Date.now()}@std.antalya.edu.tr`;
  await page.goto('/auth');
  await page.getByPlaceholder('Aylin Demir').fill('Prem Tester');
  await page.getByPlaceholder('you@example.com').fill(email);
  await page.getByPlaceholder('At least 8 characters').fill('secret123');
  await page.getByRole('button', { name: /Create account/i }).click();
  await page.waitForURL(/\/dashboard$/, { timeout: 20_000 });

  // A6: new users get a 7-day Premium trial → Day 2 is unlocked initially.
  await expect(page.getByRole('button', { name: /🔒 Day 2/ })).toHaveCount(0);

  // Switch to Free on the Premium page (ends the trial) to reach the paywall.
  await page.getByRole('link', { name: /Premium/ }).click();
  await expect(page).toHaveURL(/\/premium$/);
  await page.getByRole('button', { name: /Switch to Free/i }).click();
  await expect(page.getByRole('button', { name: /Upgrade to Premium/i })).toBeVisible({ timeout: 10_000 });

  // Back on the dashboard Day 2 is now locked with an optimize counter.
  await page.getByRole('link', { name: 'Plan', exact: true }).click();
  await page.waitForURL(/\/dashboard$/);
  await expect(page.getByRole('button', { name: /🔒 Day 2/ })).toBeVisible();
  await expect(page.getByText(/optimizations left today/i)).toBeVisible();

  // Upgrade → Day 2 unlocked + unlimited.
  await page.getByRole('link', { name: /Premium/ }).click();
  await page.getByRole('button', { name: /Upgrade to Premium/i }).click();
  await expect(page.getByRole('button', { name: /Switch to Free/i })).toBeVisible({ timeout: 10_000 });
  await page.getByRole('link', { name: 'Plan', exact: true }).click();
  await page.waitForURL(/\/dashboard$/);
  await expect(page.getByRole('button', { name: /🔒 Day 2/ })).toHaveCount(0);
  await expect(page.getByText(/Unlimited/i)).toBeVisible();
});

test('offline mode: banner, disabled network actions, and IndexedDB cache', async ({ page }) => {
  // NOTE: a true offline *reload* is served by the service worker's precache,
  // which vite-plugin-pwa builds for production (sw.js) but not for the dev
  // server. Here we verify the offline UX + that the plan is cached to
  // IndexedDB for offline hydration.
  const email = `e2e_off_${Date.now()}@std.antalya.edu.tr`;
  await page.goto('/auth');
  await page.getByPlaceholder('Aylin Demir').fill('Offline Tester');
  await page.getByPlaceholder('you@example.com').fill(email);
  await page.getByPlaceholder('At least 8 characters').fill('secret123');
  await page.getByRole('button', { name: /Create account/i }).click();
  await page.waitForURL(/\/dashboard$/, { timeout: 15_000 });
  await expect(page.getByRole('heading', { name: /Today.s Path/i })).toBeVisible();

  // The generated plan is persisted to IndexedDB for offline use.
  const cached = await page.waitForFunction(async () => {
    const db: IDBDatabase = await new Promise((res, rej) => {
      const r = indexedDB.open('pathwise-offline', 1);
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    const val = await new Promise((res) => {
      const tx = db.transaction('cache', 'readonly').objectStore('cache').get('day-itineraries');
      tx.onsuccess = () => res(tx.result);
      tx.onerror = () => res(null);
    });
    return Array.isArray(val) && val[0] && (val[0] as { stops: unknown[] }).stops.length > 0;
  }, { timeout: 10_000 });
  expect(await cached.jsonValue()).toBe(true);

  // Toggle offline → banner + network actions disabled.
  await page.getByRole('button', { name: /📶 Online/ }).click();
  await expect(page.getByText(/Offline Mode/i)).toBeVisible();
  await expect(page.getByRole('button', { name: /connection required/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /💾 Save plan/ })).toBeDisabled();
});

test('currency converter shows converted budget and calendar export works', async ({ page }) => {
  const email = `e2e_cur_${Date.now()}@std.antalya.edu.tr`;
  await page.goto('/auth');
  await page.getByPlaceholder('Aylin Demir').fill('Cur Tester');
  await page.getByPlaceholder('you@example.com').fill(email);
  await page.getByPlaceholder('At least 8 characters').fill('secret123');
  await page.getByRole('button', { name: /Create account/i }).click();
  await page.waitForURL(/\/dashboard$/, { timeout: 15_000 });
  await expect(page.getByRole('heading', { name: /Today.s Path/i })).toBeVisible();

  // B4: switch display currency to USD → converted budget appears.
  await page.getByLabel('Display currency').selectOption('USD');
  await expect(page.getByText(/≈ \$/).first()).toBeVisible();

  // B5: export dropdown offers .ics and downloads it.
  await page.getByRole('button', { name: /Export/ }).click();
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: /Add to Calendar/i }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/\.ics$/);
});

test('notification center receives a nearby alert and can mute types', async ({ page }) => {
  const email = `e2e_ntf_${Date.now()}@std.antalya.edu.tr`;
  await page.goto('/auth');
  await page.getByPlaceholder('Aylin Demir').fill('Notif Tester');
  await page.getByPlaceholder('you@example.com').fill(email);
  await page.getByPlaceholder('At least 8 characters').fill('secret123');
  await page.getByRole('button', { name: /Create account/i }).click();
  await page.waitForURL(/\/dashboard$/, { timeout: 15_000 });

  // Visiting Social emits a "nearby" notification.
  await page.getByRole('link', { name: 'Social', exact: true }).click();
  await page.waitForURL(/\/social$/);
  await expect(page.getByRole('heading', { name: /Social & Travel Buddies/i })).toBeVisible();

  // Bell shows an unread badge; open it and see the notification + preferences.
  const bell = page.getByRole('button', { name: 'Notifications' });
  await expect(bell).toContainText(/[1-9]/, { timeout: 10_000 });
  await bell.click();
  await expect(page.getByText(/Friend nearby/i)).toBeVisible();
  // Open preferences (⚙) and confirm a mutable type is listed.
  await page.getByRole('button', { name: '⚙' }).click();
  await expect(page.getByText(/Budget alerts/i)).toBeVisible();
});

test('selective offline: download a chosen day and see its size', async ({ page }) => {
  const email = `e2e_dl_${Date.now()}@std.antalya.edu.tr`;
  await page.goto('/auth');
  await page.getByPlaceholder('Aylin Demir').fill('DL Tester');
  await page.getByPlaceholder('you@example.com').fill(email);
  await page.getByPlaceholder('At least 8 characters').fill('secret123');
  await page.getByRole('button', { name: /Create account/i }).click();
  await page.waitForURL(/\/dashboard$/, { timeout: 15_000 });
  await expect(page.getByRole('heading', { name: /Today.s Path/i })).toBeVisible();

  // Open the Offline download menu → per-day list with MB sizes.
  await page.getByRole('button', { name: /📥 Offline/ }).click();
  await expect(page.getByText(/Download for offline/i)).toBeVisible();
  await expect(page.getByText(/MB/).first()).toBeVisible();

  // Download Day 1 → it flips to "Saved".
  await page.getByRole('button', { name: /⬇ Download/ }).first().click();
  await expect(page.getByRole('button', { name: /✓ Saved/ }).first()).toBeVisible();
});

test('group poll: create, vote, and see the tally', async ({ page }) => {
  const email = `e2e_poll_${Date.now()}@std.antalya.edu.tr`;
  await page.goto('/auth');
  await page.getByPlaceholder('Aylin Demir').fill('Poll Tester');
  await page.getByPlaceholder('you@example.com').fill(email);
  await page.getByPlaceholder('At least 8 characters').fill('secret123');
  await page.getByRole('button', { name: /Create account/i }).click();
  await page.waitForURL(/\/dashboard$/, { timeout: 30_000 });

  await page.getByRole('link', { name: 'Social', exact: true }).click();
  await page.waitForURL(/\/social$/);
  await expect(page.getByRole('heading', { name: /Group Polls/i })).toBeVisible({ timeout: 15_000 });

  // Start a poll, pick two options, create.
  await page.getByRole('button', { name: /Start Poll/i }).first().click();
  await page.getByPlaceholder(/Where should we go/i).fill('Best coffee?');
  const opts = page.getByRole('button', { name: /^☐ / });
  await opts.nth(0).click();
  await opts.nth(1).click();
  const q = `Best coffee ${Date.now()}?`;
  await page.getByPlaceholder(/Where should we go/i).fill(q);
  await page.getByRole('button', { name: /Create poll/i }).click();

  // Scope to THIS poll's card (polls are global across users) and vote.
  const card = page.locator('div.rounded-2xl', { hasText: q });
  await expect(card).toBeVisible();
  await card.getByRole('button').filter({ hasText: /· \d+%/ }).first().click();
  await expect(card.getByText(/100%/)).toBeVisible({ timeout: 10_000 });
});

test('search bar finds a place and adds it to Today’s Path', async ({ page }) => {
  const email = `e2e_search_${Date.now()}@std.antalya.edu.tr`;
  await page.goto('/auth');
  await page.getByPlaceholder('Aylin Demir').fill('Search Tester');
  await page.getByPlaceholder('you@example.com').fill(email);
  await page.getByPlaceholder('At least 8 characters').fill('secret123');
  await page.getByRole('button', { name: /Create account/i }).click();
  await page.waitForURL(/\/dashboard$/, { timeout: 20_000 });
  await expect(page.getByRole('heading', { name: /Today.s Path/i })).toBeVisible();

  const search = page.getByPlaceholder(/Search a place/i);
  // Empty state for a nonsense query.
  await search.fill('zzzzzz');
  await expect(page.getByText(/we.ll add it soon/i)).toBeVisible({ timeout: 5_000 });

  // Real query → result appears; add it to the path.
  await search.fill('Hagia');
  const result = page.getByRole('button', { name: /Hagia Sophia/i });
  await expect(result).toBeVisible({ timeout: 5_000 });
  await page.getByRole('button', { name: '➕ Add' }).first().click();

  // Hagia Sophia (forced in) now appears among the day's stops.
  await expect(page.locator('ol li h3', { hasText: 'Hagia Sophia' })).toBeVisible({ timeout: 10_000 });
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
