import { expect, type Page } from '@playwright/test';

/**
 * Follow a link that lives in the header's "More" menu.
 *
 * Essentials, Tours, Blog and Premium are not top-level links any more. The
 * nav asked for 476px on a 375px screen with six of them, so the four things
 * you *do* stayed visible and the things you *read* moved behind a menu.
 *
 * Shared rather than copied into each spec: four specs navigate this way, and
 * four copies of a menu-opening sequence is four places to fix when the menu
 * changes again.
 */
export async function openFromMoreMenu(page: Page, name: RegExp): Promise<void> {
  await page.getByRole('button', { name: /More|Daha fazla/ }).click();
  const menu = page.getByTestId('nav-more-menu');
  await expect(menu).toBeVisible();
  await menu.getByRole('menuitem', { name }).click();
}
