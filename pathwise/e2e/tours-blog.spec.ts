import { test, expect, type Page } from '@playwright/test';

/**
 * The Tours referral page, the Blog, and the navigation that reaches them.
 *
 * Requires the stack running (docker compose up -d).
 */

async function signUp(page: Page, tag: string) {
  const email = `tb_${tag}_${Date.now()}@std.antalya.edu.tr`;
  await page.goto('/auth');
  await page.getByPlaceholder('Aylin Demir').fill('Tours Tester');
  await page.getByPlaceholder('you@example.com').fill(email);
  await page.getByPlaceholder('At least 8 characters').fill('secret123');
  await page.getByRole('button', { name: /Create account/i }).click();
  await page.waitForURL(/\/dashboard$/, { timeout: 20_000 });
}

/** Open the "More" menu and follow one of its links. */
async function viaMoreMenu(page: Page, name: RegExp) {
  await page.getByRole('button', { name: /More|Daha fazla/ }).click();
  await expect(page.getByTestId('nav-more-menu')).toBeVisible();
  await page.getByTestId('nav-more-menu').getByRole('menuitem', { name }).click();
}

// ── Navigation ────────────────────────────────────────────────────────

test('the four primary tabs stay visible and the rest live behind More', async ({ page }) => {
  await signUp(page, 'nav');
  const nav = page.locator('header nav');

  for (const name of [/^Plan$/, /^Social$/, /^Messages$/, /^Profile$/]) {
    await expect(nav.getByRole('link', { name })).toBeVisible();
  }
  // Closed by default — otherwise it is not a menu, it is four more links.
  await expect(page.getByTestId('nav-more-menu')).toHaveCount(0);
  await expect(nav.getByRole('link', { name: /^Essentials$/ })).toHaveCount(0);

  await page.getByRole('button', { name: /More/ }).click();
  const menu = page.getByTestId('nav-more-menu');
  for (const name of [/Essentials/, /Tours/, /Blog/, /Premium/]) {
    await expect(menu.getByRole('menuitem', { name })).toBeVisible();
  }

  // Escape dismisses it. A menu that can only be closed by choosing something
  // is a trap on a phone, where there is no cursor to click away with.
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('nav-more-menu')).toHaveCount(0);
});

test('the nav fits a phone screen', async ({ page }) => {
  await signUp(page, 'fit');
  await page.setViewportSize({ width: 375, height: 800 });

  // The measurement that motivated the change: six links needed 476px on a
  // 375px screen. Asserted rather than described, so a seventh primary link
  // added later fails here instead of on someone's phone.
  const width = await page.evaluate(
    () => (document.querySelector('header nav') as HTMLElement).scrollWidth,
  );
  expect(width, `nav is ${width}px wide on a 375px screen`).toBeLessThanOrEqual(375);
});

// ── Tours ─────────────────────────────────────────────────────────────

test('tours link out to GetYourGuide and never quote a price', async ({ page }) => {
  await signUp(page, 'tours');
  await viaMoreMenu(page, /Tours/);
  await page.waitForURL(/\/tours$/);

  const cards = page.getByTestId('tour-card');
  await expect(cards).toHaveCount(3);

  // The affiliate relationship is stated on the page, not only in an attribute.
  await expect(page.getByText(/affiliate links/i)).toBeVisible();

  for (const url of ['https://gyg.me/SehMD5H0', 'https://gyg.me/FkXUBF9r', 'https://gyg.me/fTDITut1']) {
    const link = page.locator(`a[href="${url}"]`);
    await expect(link).toHaveCount(1);
    await expect(link).toHaveAttribute('target', '_blank');
    // `sponsored` is the honest description of a paid referral; `noopener`
    // stops the opened tab reaching back into this one.
    await expect(link).toHaveAttribute('rel', /sponsored/);
    await expect(link).toHaveAttribute('rel', /noopener/);
  }

  /**
   * No price, anywhere on this page.
   *
   * We do not have GetYourGuide's live prices, so any number here would be
   * invented — and an invented price is a quote a reader can hold us to. This
   * asserts the absence directly rather than trusting that nobody adds one.
   */
  const body = (await page.locator('main').textContent()) ?? '';
  expect(body).not.toMatch(/[₺$€]\s?\d/);
  expect(body).not.toMatch(/\d+\s?(TRY|TL|USD|EUR)\b/i);
});

// ── Blog ──────────────────────────────────────────────────────────────

test('the blog lists posts and opens one', async ({ page }) => {
  await signUp(page, 'blog');
  await viaMoreMenu(page, /Blog/);
  await page.waitForURL(/\/blog$/);

  await expect(page.getByTestId('blog-card')).toHaveCount(3);

  await page.getByTestId('blog-card').filter({ hasText: /sunset/i }).click();
  await page.waitForURL(/\/blog\/gun-batimi-8-yer$/);

  const post = page.getByTestId('blog-post');
  await expect(post.getByRole('heading', { level: 1 })).toContainText(/sunset/i);
  // The markdown actually rendered: eight headings, not eight lines of "## 1.".
  await expect(post.getByRole('heading', { level: 2 })).toHaveCount(8);
  await expect(post.getByText('##')).toHaveCount(0);

  // An in-app link inside a post is a real link, and it works.
  await post.getByRole('link', { name: /route builder/i }).click();
  await page.waitForURL(/\/dashboard$/);
});

test('a post survives a direct link and a reload', async ({ page }) => {
  await signUp(page, 'deep');
  await page.goto('/blog/cami-ziyareti');
  await expect(page.getByTestId('blog-post')).toBeVisible({ timeout: 15_000 });
  await page.reload();
  await expect(page.getByTestId('blog-post').getByRole('heading', { level: 1 })).toBeVisible();
});

test('an unknown slug says so instead of silently redirecting', async ({ page }) => {
  await signUp(page, '404');
  await page.goto('/blog/no-such-post');
  await expect(page.getByText(/does not exist/i)).toBeVisible({ timeout: 15_000 });
  // Still on the URL that was asked for — a redirect would hide the bad link.
  expect(page.url()).toContain('/blog/no-such-post');
});

// ── Quiz deep link ────────────────────────────────────────────────────

test('the vibe quiz can be linked to, and closing it clears the link', async ({ page }) => {
  await signUp(page, 'quiz');

  // It used to be a useState boolean, so this URL did nothing at all.
  await page.goto('/dashboard?quiz=1');
  await expect(page.getByText(/Vibe Quiz|Seyahat Tarz/i).first()).toBeVisible({ timeout: 20_000 });

  // The ✕ carries an aria-label rather than text, which is how it should be
  // addressed — matching on the glyph would break the day it becomes an icon.
  await page.getByRole('button', { name: /Cancel|Vazgeç/i }).first().click();
  await expect.poll(() => page.url()).not.toContain('quiz=1');
});
