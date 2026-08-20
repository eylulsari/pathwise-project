import { test, expect, type Page } from '@playwright/test';

/**
 * The parts of signing up that are about the person doing it.
 *
 * Before this, the form sent everything to the server and printed whatever
 * came back — so a short password produced "password must be longer than or
 * equal to 8 characters", in English, in an app that speaks six languages. And
 * a new account landed on a dashboard where a route was already generating,
 * with nothing saying what had been decided or by whom.
 */

async function gotoSignIn(page: Page): Promise<void> {
  await page.goto('/auth');
  await page.getByRole('button', { name: /Sign in/i }).first().click();
}

test('the form answers for itself, without asking the server', async ({ page }) => {
  await page.goto('/auth');

  let requests = 0;
  page.on('request', (r) => {
    if (r.url().includes('/auth/register')) requests += 1;
  });

  await page.getByPlaceholder('Aylin Demir').fill('A');
  await page.getByPlaceholder('you@example.com').fill('not-an-address');
  await page.getByPlaceholder('At least 8 characters').fill('short');
  await page.getByRole('button', { name: /Create account/i }).click();

  // Each complaint sits under the field it is about.
  await expect(page.getByTestId('auth-name-error')).toBeVisible();
  await expect(page.getByTestId('auth-email-error')).toBeVisible();
  await expect(page.getByTestId('auth-password-error')).toBeVisible();

  // In a sentence, not a validator's phrasing.
  await expect(page.getByTestId('auth-password-error')).toContainText(/at least 8 characters/i);
  await expect(page.getByTestId('auth-password-error')).not.toContainText(/longer than or equal/i);

  // And nothing was sent: the form knew the answer already.
  expect(requests).toBe(0);
});

test('a complaint waits until you have left the field', async ({ page }) => {
  await page.goto('/auth');
  const password = page.getByPlaceholder('At least 8 characters');

  await password.fill('a');
  // Still typing — no telling-off yet.
  await expect(page.getByTestId('auth-password-error')).toHaveCount(0);

  await password.blur();
  await expect(page.getByTestId('auth-password-error')).toBeVisible();
});

test('a rejected sign-in reads like a sentence, not a status', async ({ page }) => {
  await gotoSignIn(page);
  await page.getByPlaceholder('you@example.com').fill('nobody@std.antalya.edu.tr');
  await page.getByPlaceholder(/characters|Password/i).first().fill('wrong-password-here');
  await page.getByRole('button', { name: /^Sign in$/i }).click();

  const message = page.locator('form p.text-terracotta').first();
  await expect(message).toBeVisible({ timeout: 15_000 });
  await expect(message).toContainText(/do not match/i);
  // The server's own wording must not reach the screen.
  await expect(message).not.toContainText(/invalid credentials/i);
});

test('forgotten password says what is true, and offers a way through', async ({
  page,
}) => {
  await gotoSignIn(page);

  await page.getByTestId('forgot-password').click();
  const note = page.getByTestId('forgot-password-note');
  await expect(note).toBeVisible();

  // It admits the limitation rather than collecting an address and doing
  // nothing with it — there is no provider to send the mail.
  await expect(note).toContainText(/cannot reset passwords by email yet/i);
  await expect(note).toContainText(/write to us/i);

  // And it is not a form: nothing here takes an address and implies a send.
  await expect(note.getByRole('textbox')).toHaveCount(0);
  await expect(note.getByRole('button')).toHaveCount(0);
});

test('a new account is greeted once, and can walk straight past it', async ({ page }) => {
  await page.goto('/auth');
  await page.getByPlaceholder('Aylin Demir').fill('Welcome Tester');
  await page
    .getByPlaceholder('you@example.com')
    .fill(`e2e_welcome_${Date.now()}@std.antalya.edu.tr`);
  await page.getByPlaceholder('At least 8 characters').fill('secret123');
  await page.getByRole('button', { name: /Create account/i }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 20_000 });

  const welcome = page.getByTestId('welcome-modal');
  await expect(welcome).toBeVisible({ timeout: 20_000 });
  await expect(welcome).toContainText(/Pathwise/);

  await page.getByTestId('welcome-start').click();
  await expect(welcome).toHaveCount(0);

  // Gone from the URL too, so a reload does not bring it back — a greeting
  // that reappears is an interruption, not a welcome.
  await expect(page).toHaveURL(/\/dashboard(?!.*welcome)/);
  await page.reload();
  await expect(page.getByRole('heading', { name: /Today.s Path/i })).toBeVisible({
    timeout: 25_000,
  });
  await expect(page.getByTestId('welcome-modal')).toHaveCount(0);
});

test('the password can be looked at, and the form says when Caps Lock is on', async ({
  page,
}) => {
  await page.goto('/auth');
  const password = page.getByPlaceholder('At least 8 characters');
  await password.fill('secret123');

  // Hidden by default — the eye is an affordance, not the resting state.
  await expect(password).toHaveAttribute('type', 'password');
  await page.getByTestId('auth-password-toggle').click();
  await expect(password).toHaveAttribute('type', 'text');
  // And the caret is still in the box: revealing a password should not cost
  // the traveller their place in it.
  await expect(password).toBeFocused();

  await page.getByTestId('auth-password-toggle').click();
  await expect(password).toHaveAttribute('type', 'password');

  // Caps Lock is read from the keyboard event's modifier state, so it is
  // right the moment it is true rather than guessed from what was typed.
  //
  // Driven with a synthetic event on purpose: `keyboard.press('CapsLock')`
  // sends the keystroke but does not toggle the OS-level modifier that
  // getModifierState reports, so the high-level API cannot express the state
  // this feature reads. Dispatching the event with the modifier set exercises
  // the same handler the browser would call.
  const capsKey = (on: boolean) =>
    password.evaluate((el, capsOn) => {
      el.dispatchEvent(
        new KeyboardEvent('keyup', {
          key: 'a',
          bubbles: true,
          // Non-standard init, honoured by Chromium — checked before relying
          // on it, because a silently ignored flag would make this test pass
          // against a feature that does nothing.
          modifierCapsLock: capsOn,
        } as KeyboardEventInit),
      );
    }, on);

  await expect(page.getByTestId('auth-caps-lock')).toHaveCount(0);
  await capsKey(true);
  await expect(page.getByTestId('auth-caps-lock')).toBeVisible();
  await capsKey(false);
  await expect(page.getByTestId('auth-caps-lock')).toHaveCount(0);

  // And it goes away when the box does, rather than lingering over a field
  // nobody is typing in.
  await capsKey(true);
  await expect(page.getByTestId('auth-caps-lock')).toBeVisible();
  await password.blur();
  await expect(page.getByTestId('auth-caps-lock')).toHaveCount(0);
});

test('"keep me signed in" decides where the session is kept', async ({ page }) => {
  await page.goto('/auth');
  const remember = page.getByTestId('auth-remember');
  // On by default, because that is how every existing session already behaves.
  await expect(remember).toBeChecked();
  await remember.uncheck();

  await page.getByPlaceholder('Aylin Demir').fill('Session Tester');
  await page
    .getByPlaceholder('you@example.com')
    .fill(`e2e_remember_${Date.now()}@std.antalya.edu.tr`);
  await page.getByPlaceholder('At least 8 characters').fill('secret123');
  await page.getByRole('button', { name: /Create account/i }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 20_000 });

  const where = await page.evaluate(() => ({
    local: localStorage.getItem('pathwise.access'),
    session: sessionStorage.getItem('pathwise.access'),
  }));
  // The tab holds it; the browser does not. Closing the tab ends the session
  // on this machine, which is the whole promise of leaving the box unticked.
  expect(where.session).not.toBeNull();
  expect(where.local).toBeNull();
});

test('a rejected sign-in is felt as well as read, and the form survives it', async ({
  page,
}) => {
  await gotoSignIn(page);
  await page.getByPlaceholder('you@example.com').fill('nobody@std.antalya.edu.tr');
  await page.getByPlaceholder(/characters|Password/i).first().fill('wrong-password-here');
  await page.getByRole('button', { name: /^Sign in$/i }).click();

  await expect(page.getByTestId('auth-error')).toBeVisible({ timeout: 15_000 });

  // The shake is a nudge, not a reset: what was typed is still there, so the
  // traveller fixes one field rather than filling the form again.
  await expect(page.getByPlaceholder('you@example.com')).toHaveValue(
    'nobody@std.antalya.edu.tr',
  );
});

test('the social buttons admit they are not connected to anything', async ({ page }) => {
  await page.goto('/auth');

  for (const id of ['auth-social-google', 'auth-social-apple']) {
    const button = page.getByTestId(id);
    await expect(button).toBeVisible();
    // Disabled, not merely inert: a button that looks ready and does nothing
    // when pressed is worse than one that never offered.
    await expect(button).toBeDisabled();
  }

  await expect(page.getByTestId('auth-social-note')).toContainText(
    /not wired to a provider yet/i,
  );
});
