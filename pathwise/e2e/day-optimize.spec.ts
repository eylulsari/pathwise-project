import { test, expect, Page } from '@playwright/test';

/**
 * Day optimisation: same stops, shorter route, and always reversible.
 *
 * The claims worth testing are the ones a traveller would be hurt by if they
 * were false — that pressing the button cannot lose a stop, cannot be
 * irreversible, and cannot silently claim a saving it did not make. The search
 * itself is covered by unit tests in optimize.spec.ts, where the geometry can
 * be controlled; here the point is that the whole path works end to end.
 */

async function signUp(page: Page, tag: string): Promise<void> {
  await page.goto('/auth');
  await page.getByPlaceholder('Aylin Demir').fill('Optimize Tester');
  await page
    .getByPlaceholder('you@example.com')
    .fill(`e2e_${tag}_${Date.now()}@std.antalya.edu.tr`);
  await page.getByPlaceholder('At least 8 characters').fill('secret123');
  await page.getByRole('button', { name: /Create account/i }).click();
  await page.waitForURL(/\/dashboard$/, { timeout: 20_000 });
  await expect(page.getByRole('heading', { name: /Today.s Path/i })).toBeVisible();
}

/** The stop names in Today's Path, in order. */
async function stopNames(page: Page): Promise<string[]> {
  await expect(page.locator('li h3').first()).toBeVisible({ timeout: 20_000 });
  return page.locator('li h3').allTextContents();
}

test('optimising keeps every stop and reports what it did', async ({ page }) => {
  await signUp(page, 'opt');

  const before = await stopNames(page);
  expect(before.length).toBeGreaterThan(2);

  await page.getByTestId('optimize-day').click();
  const summary = page.getByTestId('optimize-summary');
  await expect(summary).toBeVisible({ timeout: 20_000 });

  // Whatever it decided, the day still holds exactly the same stops. An
  // "optimiser" that quietly drops one is shortening the day by deleting it.
  const after = await stopNames(page);
  expect([...after].sort()).toEqual([...before].sort());

  // And it states the limit of what it checked rather than implying it
  // verified opening hours it has no data for.
  await expect(summary).toContainText(/Opening hours checked for \d+ of \d+ stops/i);
});

/**
 * Drag the first stop all the way to the end of the day.
 *
 * The engine already orders stops sensibly, so a freshly generated day usually
 * has nothing to optimise — and the assertions that matter here would be
 * skipped against it. A short hop (first stop to third) is not enough either:
 * the stops in one hub sit a few hundred metres apart, so a small permutation
 * often costs the same or less and the optimiser rightly reports no change.
 * Sending the first stop to the back is the perturbation that reliably adds a
 * return leg across the whole cluster.
 *
 * Shape copied from route-editing.spec.ts — dnd-kit needs the pointer to travel
 * (6px activation) and needs intermediate moves to find a drop target.
 */
async function makeDaySuboptimal(page: Page): Promise<void> {
  const handles = page.locator('button[title="Drag to reorder"]');
  const before = await stopNames(page);
  const last = (await handles.count()) - 1;
  await handles.nth(0).hover();
  await page.mouse.down();
  const target = await handles.nth(last).boundingBox();
  if (!target) throw new Error('last drag handle has no box');
  await page.mouse.move(target.x, target.y - 60, { steps: 12 });
  await page.mouse.move(target.x, target.y + 20, { steps: 12 });
  await page.mouse.up();
  await expect
    .poll(async () => (await stopNames(page))[0], { timeout: 15_000 })
    .not.toBe(before[0]);
}

test('an improved day shows before and after, and undo puts it back', async ({ page }) => {
  await signUp(page, 'optundo');
  await stopNames(page);

  // Scramble it first, so there is a real saving to find. Without this the
  // engine's own order is usually already good and this test would skip
  // exactly the behaviour it exists to check.
  await makeDaySuboptimal(page);
  const scrambled = await stopNames(page);

  await page.getByTestId('optimize-day').click();
  await expect(page.getByTestId('optimize-summary')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId('optimize-before')).toBeVisible();

  // The two numbers are the point of the feature: a saving nobody can see is
  // indistinguishable from a reshuffle.
  const beforeMin = Number(await page.getByTestId('optimize-before').textContent());
  const afterMin = Number(await page.getByTestId('optimize-after').textContent());
  expect(afterMin).toBeLessThan(beforeMin);

  const reordered = await stopNames(page);
  expect(reordered).not.toEqual(scrambled);
  expect([...reordered].sort()).toEqual([...scrambled].sort()); // a move, not an edit

  // Undo is not optional for a change the traveller did not compose themselves.
  await page.getByRole('button', { name: /↩/ }).click();
  await expect.poll(async () => stopNames(page), { timeout: 10_000 }).toEqual(scrambled);
  // The saving went with the change that produced it.
  await expect(page.getByTestId('optimize-summary')).toHaveCount(0);
});

test('a day too short to reorder offers no button', async ({ page }) => {
  await signUp(page, 'optshort');
  await stopNames(page);

  // Strip the day down to two stops: there is exactly one order for two, so
  // the button would be lit with nothing to do.
  const remove = page.getByRole('button', { name: /Remove/i });
  while ((await page.locator('li h3').count()) > 2) {
    await remove.first().click();
    await page.waitForTimeout(400);
  }

  await expect(page.getByTestId('optimize-day')).toHaveCount(0);
});
