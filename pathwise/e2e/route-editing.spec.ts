import { test, expect, Page } from '@playwright/test';

/**
 * Editing a generated route, and having the edit survive.
 *
 * The reload is the whole point of these tests. Reordering and removing stops
 * already worked in the browser before the working plan was persisted — they
 * just did not outlive the tab, which made the feature feel like a toy. So
 * every assertion here is made *after* a full page reload, against what the
 * server sent back rather than what React still had in memory.
 */

async function signUp(page: Page, tag: string): Promise<void> {
  await page.goto('/auth');
  await page.getByPlaceholder('Aylin Demir').fill('Edit Tester');
  await page
    .getByPlaceholder('you@example.com')
    .fill(`e2e_${tag}_${Date.now()}@std.antalya.edu.tr`);
  await page.getByPlaceholder('At least 8 characters').fill('secret123');
  await page.getByRole('button', { name: /Create account/i }).click();
  await page.waitForURL(/\/dashboard$/, { timeout: 20_000 });
  await expect(page.getByRole('heading', { name: /Today.s Path/i })).toBeVisible();
}

/** The stop names in Today's Path, in order, skipping the synthetic lunch break. */
async function stopNames(page: Page): Promise<string[]> {
  await expect(page.locator('li h3').first()).toBeVisible({ timeout: 20_000 });
  return page.locator('li h3').allTextContents();
}

/** Waits until the plan the server holds matches what is on screen. */
async function waitForAutosave(page: Page, expected: string[]): Promise<void> {
  await expect.poll(async () => stopNames(page), { timeout: 15_000 }).toEqual(expected);
  // The autosave is debounced; give it room to fire and land.
  await page.waitForTimeout(2000);
}

test('a reordered day survives a reload', async ({ page }) => {
  await signUp(page, 'reorder');

  const before = await stopNames(page);
  expect(before.length).toBeGreaterThan(2);

  // Drag the first stop's handle onto the third row. Using the handle rather
  // than the card matters — the card is a click target for selecting a stop.
  const handles = page.locator('button[title="Drag to reorder"]');
  await handles.nth(0).hover();
  await page.mouse.down();
  // dnd-kit needs the pointer to travel before it treats this as a drag
  // (activationConstraint: 6px), and needs intermediate moves to compute a
  // drop target — a single jump lands nowhere.
  const target = await handles.nth(2).boundingBox();
  if (!target) throw new Error('third drag handle has no box');
  await page.mouse.move(target.x, target.y - 40, { steps: 10 });
  await page.mouse.move(target.x, target.y + 10, { steps: 10 });
  await page.mouse.up();

  await expect.poll(async () => (await stopNames(page))[0], { timeout: 15_000 }).not.toBe(
    before[0],
  );
  const after = await stopNames(page);
  expect(after).not.toEqual(before);
  expect([...after].sort()).toEqual([...before].sort()); // a move, not an edit
  await waitForAutosave(page, after);

  await page.reload();
  await expect(page.getByRole('heading', { name: /Today.s Path/i })).toBeVisible();
  expect(await stopNames(page)).toEqual(after);
});

test('a saved place survives a reload and can seed the day', async ({ page }) => {
  // Six round trips in one journey: sign up, save, cross to the profile and
  // back, remove a stop, then re-seed the day from the saved list. Each step is
  // waited on properly, but the 30 s default is a budget for the *whole* test
  // and under a loaded backend this one legitimately outgrows it — it failed on
  // "Test timeout exceeded" while waiting for a button that does appear, not on
  // the button's own timeout. Splitting it would break the one thing it exists
  // to prove: that the place makes the entire trip through the server.
  test.slow();

  await signUp(page, 'saved');

  const names = await stopNames(page);
  // Save the second stop, then remove it from the day — so when it reappears
  // later it can only have come back through the saved list.
  const target = names[1];
  const row = page.locator('li').filter({ has: page.locator(`h3:text-is("${target}")`) });
  // Wait for the server's acknowledgement, not just the button flipping.
  //
  // The toggle is optimistic by design — a bookmark that waits for a round
  // trip feels broken on a phone — so the label says "Saved" while the PUT is
  // still in flight. `keepalive` stops the navigation from cancelling that
  // request, but it cannot make it *arrive first*: under a loaded backend the
  // next page's GET overtakes it and the list is legitimately empty. Waiting
  // on the response removes the ordering assumption without weakening the
  // assertion below, which still reads the list back from the server.
  await Promise.all([
    page.waitForResponse(
      (r) =>
        r.url().includes('/saved-places/') && r.request().method() === 'PUT' && r.ok(),
      { timeout: 20_000 },
    ),
    row.getByRole('button', { name: new RegExp(`^Save: ${target}`, 'i') }).click(),
  ]);
  await expect(
    row.getByRole('button', { name: new RegExp(`^Saved: ${target}`, 'i') }),
  ).toBeVisible();

  // It is on the server, not just in this tab.
  await page.goto('/profile');
  await page.getByRole('button', { name: /Saved places/i }).click();
  await expect(page.getByTestId('saved-list')).toContainText(target);

  await page.goto('/dashboard');
  await expect(page.getByRole('heading', { name: /Today.s Path/i })).toBeVisible();
  await page.getByRole('button', { name: new RegExp(`Remove: ${target}`, 'i') }).click();
  await expect
    .poll(async () => (await stopNames(page)).includes(target), { timeout: 15_000 })
    .toBe(false);
  await page.waitForTimeout(2000);

  // "Start from my saved places" puts it back, because it is saved in this hub.
  await page.getByTestId('start-from-saved').click();
  await expect
    .poll(async () => (await stopNames(page)).includes(target), { timeout: 25_000 })
    .toBe(true);
});

/**
 * The other two tests wait for the debounced autosave before reloading, which
 * is the polite case. This is the impatient one: edit and reload immediately,
 * inside the 700 ms debounce.
 *
 * Without the pagehide flush the timer is cleared by the unmount and the save
 * never fires at all, so the edit is simply gone. The flush deliberately sends
 * the stop order without the cached itineraries — keepalive caps the body at
 * 64 KB — so this also exercises the hydration path that rebuilds a day from
 * its order alone.
 */
test('an edit survives a reload fired before the autosave debounce', async ({ page }) => {
  await signUp(page, 'flush');

  const before = await stopNames(page);
  expect(before.length).toBeGreaterThan(2);

  await page.getByRole('button', { name: new RegExp(`Remove: ${before[1]}`, 'i') }).click();
  await expect
    .poll(async () => (await stopNames(page)).length, { timeout: 15_000 })
    .toBe(before.length - 1);
  const after = await stopNames(page);

  // No waiting: reload while the debounce is still pending.
  await page.reload();
  await expect(page.getByRole('heading', { name: /Today.s Path/i })).toBeVisible();
  await expect.poll(async () => stopNames(page), { timeout: 25_000 }).toEqual(after);
});

test('removing a stop recomputes the day, and it stays removed', async ({ page }) => {
  await signUp(page, 'remove');

  const before = await stopNames(page);
  expect(before.length).toBeGreaterThan(2);
  const totalBefore = await page.getByTestId('day-total-minutes').textContent();

  await page.getByRole('button', { name: new RegExp(`Remove: ${before[1]}`, 'i') }).click();

  // Gone from the list…
  await expect
    .poll(async () => (await stopNames(page)).length, { timeout: 15_000 })
    .toBe(before.length - 1);
  const after = await stopNames(page);
  expect(after).not.toContain(before[1]);

  // …and the day is genuinely recomputed, not just visually shortened. A
  // shorter day with an unchanged total would mean the times on every
  // remaining stop were now lying.
  const totalAfter = await page.getByTestId('day-total-minutes').textContent();
  expect(totalAfter).not.toBe(totalBefore);
  expect(Number(totalAfter)).toBeLessThan(Number(totalBefore));

  await waitForAutosave(page, after);
  await page.reload();
  await expect(page.getByRole('heading', { name: /Today.s Path/i })).toBeVisible();
  expect(await stopNames(page)).toEqual(after);
});
