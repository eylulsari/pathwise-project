import { test, expect, type Page } from '@playwright/test';

/**
 * Six languages, one of them right-to-left.
 *
 * The parity check already guarantees every key exists in every language, so
 * what is left to prove is the part a dictionary cannot: that switching
 * actually re-renders the UI, that the choice survives a reload, that Arabic
 * turns the document around, and — the one most likely to be got wrong — that
 * place names are NOT translated along with the chrome.
 */

async function signUp(page: Page, tag: string): Promise<void> {
  await page.goto('/auth');
  await page.getByPlaceholder('Aylin Demir').fill('I18n Tester');
  await page
    .getByPlaceholder('you@example.com')
    .fill(`e2e_${tag}_${Date.now()}@std.antalya.edu.tr`);
  await page.getByPlaceholder('At least 8 characters').fill('secret123');
  await page.getByRole('button', { name: /Create account/i }).click();
  await page.waitForURL(/\/dashboard$/, { timeout: 20_000 });
}

const pick = (page: Page) => page.getByTestId('language-select');

test('all six languages are offered and each one changes the UI', async ({ page }) => {
  await signUp(page, 'langs');

  await expect(pick(page).locator('option')).toHaveCount(6);

  // One string per language that only that language renders. "Build your path"
  // is on the dashboard in every language, so it is a fair probe.
  const expected: [string, RegExp][] = [
    ['tr', /Rotanı oluştur/i],
    ['de', /Route erstellen/i],
    ['es', /Crea tu ruta/i],
    ['ru', /Соберите маршрут/i],
    ['ar', /ابنِ مسارك/],
    ['en', /Build your path/i],
  ];

  for (const [lang, text] of expected) {
    await pick(page).selectOption(lang);
    await expect(page.getByText(text).first()).toBeVisible({ timeout: 10_000 });
  }
});

test('Arabic turns the document right-to-left, and the others stay left-to-right', async ({
  page,
}) => {
  await signUp(page, 'rtl');
  const html = page.locator('html');

  await pick(page).selectOption('ar');
  await expect(html).toHaveAttribute('dir', 'rtl');
  await expect(html).toHaveAttribute('lang', 'ar');

  // Only Arabic. A blanket "non-English is RTL" mistake would show up here.
  for (const lang of ['de', 'es', 'ru', 'tr', 'en']) {
    await pick(page).selectOption(lang);
    await expect(html).toHaveAttribute('dir', 'ltr');
    await expect(html).toHaveAttribute('lang', lang);
  }
});

test('the right-to-left layout does not break out of the page', async ({ page }) => {
  await signUp(page, 'rtllayout');
  await expect(page.locator('li h3').first()).toBeVisible({ timeout: 20_000 });

  await pick(page).selectOption('ar');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');

  // The cheapest honest check on a mechanical codemod that turned 69 physical
  // direction classes (ml-2, pl-3, right-0…) into logical ones. If any of them
  // were left pinning something to a physical side, the usual symptom is a
  // sideways scrollbar: content pushed past the edge it no longer belongs to.
  const overflow = await page.evaluate(() => ({
    scrollWidth: document.body.scrollWidth,
    innerWidth: window.innerWidth,
  }));
  expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.innerWidth + 2);

  // And the header survived: the language picker itself is still reachable,
  // which is what a wrapped or overflowing header row would take away.
  await expect(pick(page)).toBeVisible();
});

test('the chosen language survives a reload, direction included', async ({ page }) => {
  await signUp(page, 'langpersist');

  await pick(page).selectOption('ar');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');

  await page.reload();
  await page.waitForURL(/\/dashboard$/);

  // The reload restores the language from storage without anyone calling
  // setLang, so `dir` has to be applied on mount too — not only on change.
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(pick(page)).toHaveValue('ar');
});

test('place names are not translated with the interface', async ({ page }) => {
  await signUp(page, 'placenames');

  // Read the stop names in English first — these come from the backend
  // dataset, which spells them the way Istanbul does.
  await expect(page.locator('li h3').first()).toBeVisible({ timeout: 20_000 });
  const inEnglish = await page.locator('li h3').allTextContents();
  expect(inEnglish.length).toBeGreaterThan(0);

  // Switch to the two languages most likely to tempt a translator into
  // rewriting a proper noun, and confirm the names are byte-identical.
  for (const lang of ['ru', 'ar']) {
    await pick(page).selectOption(lang);
    await expect(page.locator('li h3').first()).toBeVisible();
    expect(await page.locator('li h3').allTextContents()).toEqual(inEnglish);
  }
});
