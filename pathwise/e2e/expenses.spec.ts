import { test, expect, type APIRequestContext, type Page } from '@playwright/test';

/**
 * Trip expenses.
 *
 * The settlement arithmetic is unit-tested in the backend; what these check is
 * the part only the running system can answer: that a recorded expense
 * survives a reload, that it lands against the right day's budget, that the
 * server refuses a name the traveller has no connection to, and that the panel
 * never once offers to move money.
 */

const API = process.env.E2E_API_URL ?? 'http://127.0.0.1:3000/api';

interface Account {
  id: string;
  token: string;
  email: string;
}

async function register(
  request: APIRequestContext,
  tag: string,
  name: string,
): Promise<Account> {
  const email = `exp_${tag}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}@std.antalya.edu.tr`;
  const res = await request.post(`${API}/auth/register`, {
    data: { name, email, password: 'secret123' },
  });
  expect(res.ok(), `sign-up for ${tag} failed: ${res.status()}`).toBeTruthy();
  const body = await res.json();
  return { id: body.user?.id ?? body.id, token: body.accessToken, email };
}

async function signInUi(page: Page, email: string): Promise<void> {
  await page.goto('/auth');
  await page.getByRole('button', { name: /Sign in/i }).first().click();
  await page.getByPlaceholder('you@example.com').fill(email);
  await page.getByPlaceholder(/characters|Password/i).first().fill('secret123');
  await page.getByRole('button', { name: /^Sign in$/i }).click();
  await page.waitForURL(/\/dashboard$/, { timeout: 20_000 });
}

async function openExpenses(page: Page): Promise<void> {
  await expect(page.getByRole('heading', { name: /Today.s Path/i })).toBeVisible({
    timeout: 20_000,
  });
  await page.getByRole('button', { name: /Expenses/i }).first().click();
  await expect(page.getByTestId('expense-tracker')).toBeVisible();
}

test('an expense is recorded against the budget and survives a reload', async ({
  page,
  request,
}) => {
  const me = await register(request, 'solo', 'Solo Spender');
  await signInUi(page, me.email);
  await openExpenses(page);

  await page.getByLabel('Amount').fill('600');
  await page.getByTestId('expense-category').selectOption('food');
  await page.getByTestId('expense-add').click();

  await expect(page.getByTestId('expense-row')).toHaveCount(1, { timeout: 15_000 });
  await expect(page.getByTestId('expense-total')).toContainText('600');

  // Against the plan, not just a running total: the default day budget is
  // ₺2000, so ₺600 leaves ₺1400. Lira are grouped Turkish-style (₺1.400), so
  // the separator is matched rather than assumed.
  await expect(page.getByTestId('expense-budget')).toContainText(/1[.,]400/);

  // The old Split Bill modal kept its items in component state and lost them
  // on any reload. This is the difference that makes it a ledger.
  await page.reload();
  await openExpenses(page);
  await expect(page.getByTestId('expense-row')).toHaveCount(1, { timeout: 15_000 });
  await expect(page.getByTestId('expense-total')).toContainText('600');
});

test('the panel says it keeps a record and never offers to move money', async ({
  page,
  request,
}) => {
  const me = await register(request, 'norail', 'No Rail');
  await signInUi(page, me.email);
  await openExpenses(page);

  // Stated outright, not left to be inferred from the absence of a button.
  await expect(page.getByTestId('expense-record-only')).toContainText(
    /never moves money/i,
  );

  const panel = page.getByTestId('expense-tracker');
  for (const forbidden of [/^Pay\b/i, /Pay now/i, /Send money/i, /Checkout/i]) {
    await expect(panel.getByRole('button', { name: forbidden })).toHaveCount(0);
  }
});

test('a shared expense settles between connected buddies, and only them', async ({
  page,
  request,
}) => {
  const me = await register(request, 'payer', 'Payer One');
  const buddy = await register(request, 'buddy', 'Buddy Two');
  const stranger = await register(request, 'stranger', 'Stranger Three');

  const auth = (a: Account) => ({ authorization: `Bearer ${a.token}` });

  // A name you have no connection to cannot be attached to a debt — the same
  // consent rule messaging enforces, checked on the server not in the form.
  const refused = await request.post(`${API}/expenses`, {
    headers: auth(me),
    data: {
      dayIndex: 0,
      category: 'food',
      amount: 100,
      currency: 'TRY',
      participantIds: [me.id, stranger.id],
    },
  });
  expect(refused.status()).toBe(403);

  await request.post(`${API}/messages/connections/${buddy.id}/request`, {
    headers: auth(me),
  });
  await request.post(`${API}/messages/connections/${me.id}/accept`, {
    headers: auth(buddy),
  });

  await signInUi(page, me.email);
  await openExpenses(page);

  await page.getByLabel('Amount').fill('300');
  await page.getByRole('button', { name: 'Buddy Two', exact: true }).click();
  await page.getByTestId('expense-add').click();

  // Half of ₺300, owed to the person who paid it.
  await expect(page.getByTestId('expense-settlement')).toContainText('Buddy Two', {
    timeout: 15_000,
  });
  await expect(page.getByTestId('expense-settlement')).toContainText('150');

  // And it is the payer's record, not a debt written into the buddy's account.
  const theirs = await request.get(`${API}/expenses`, { headers: auth(buddy) });
  expect(theirs.ok()).toBeTruthy();
  const ledger = await theirs.json();
  expect(ledger.expenses).toHaveLength(0);
  expect(ledger.debts).toHaveLength(0);
});
