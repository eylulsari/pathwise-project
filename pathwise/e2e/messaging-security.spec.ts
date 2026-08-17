import { test, expect, type APIRequestContext } from '@playwright/test';

/**
 * The messaging rules, asserted against the running API.
 *
 * These deliberately never touch the UI. Hiding a button proves nothing about
 * who may send a message — the question is what the server does when a request
 * arrives without one, which is the shape any real abuse takes. So every call
 * here is a raw HTTP request with a real token.
 */

const API = process.env.E2E_API_URL ?? 'http://127.0.0.1:3000/api';

interface Account {
  id: string;
  token: string;
}

async function signUp(request: APIRequestContext, tag: string): Promise<Account> {
  const res = await request.post(`${API}/auth/register`, {
    data: {
      name: `Msg ${tag}`,
      email: `msg_${tag}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}@std.antalya.edu.tr`,
      password: 'secret123',
    },
  });
  expect(res.ok(), `sign-up for ${tag} failed: ${res.status()}`).toBeTruthy();
  const body = await res.json();
  return { id: body.user?.id ?? body.id, token: body.accessToken };
}

const auth = (a: Account) => ({ authorization: `Bearer ${a.token}` });

const send = (request: APIRequestContext, from: Account, to: Account, body = 'hello') =>
  request.post(`${API}/messages/${to.id}`, { headers: auth(from), data: { body } });

const connect = async (request: APIRequestContext, a: Account, b: Account) => {
  const asked = await request.post(`${API}/messages/connections/${b.id}/request`, {
    headers: auth(a),
  });
  expect(asked.status()).toBe(204);
  const accepted = await request.post(`${API}/messages/connections/${a.id}/accept`, {
    headers: auth(b),
  });
  expect(accepted.status()).toBe(204);
};

test('two unconnected users cannot message each other — the server refuses', async ({
  request,
}) => {
  const alice = await signUp(request, 'alice');
  const bob = await signUp(request, 'bob');

  const res = await send(request, alice, bob);
  expect(res.status()).toBe(403);

  // And nothing was stored: the thread endpoint refuses too, so a refused
  // send cannot be read back by either party.
  const read = await request.get(`${API}/messages/${bob.id}`, { headers: auth(alice) });
  expect(read.status()).toBe(403);
});

test('a pending request is not consent — still refused until accepted', async ({ request }) => {
  const alice = await signUp(request, 'pend-a');
  const bob = await signUp(request, 'pend-b');

  const asked = await request.post(`${API}/messages/connections/${bob.id}/request`, {
    headers: auth(alice),
  });
  expect(asked.status()).toBe(204);

  // This is the case that a "is there a row?" check would let through.
  expect((await send(request, alice, bob)).status()).toBe(403);
  expect((await send(request, bob, alice)).status()).toBe(403);

  const accepted = await request.post(`${API}/messages/connections/${alice.id}/accept`, {
    headers: auth(bob),
  });
  expect(accepted.status()).toBe(204);
  expect((await send(request, alice, bob)).ok()).toBeTruthy();
});

test('after a block, messages are refused in both directions and the history is gone', async ({
  request,
}) => {
  const alice = await signUp(request, 'blk-a');
  const bob = await signUp(request, 'blk-b');
  await connect(request, alice, bob);

  expect((await send(request, alice, bob, 'before the block')).ok()).toBeTruthy();
  const before = await request.get(`${API}/messages/${bob.id}`, { headers: auth(alice) });
  expect((await before.json()).length).toBe(1);

  const blocked = await request.post(`${API}/messages/blocks/${bob.id}`, { headers: auth(alice) });
  expect(blocked.status()).toBe(204);

  // Neither party may send — including the one who did the blocking.
  expect((await send(request, alice, bob, 'after')).status()).toBe(403);
  expect((await send(request, bob, alice, 'after')).status()).toBe(403);

  // And the past conversation is unreadable from both sides.
  expect((await request.get(`${API}/messages/${bob.id}`, { headers: auth(alice) })).status()).toBe(403);
  expect((await request.get(`${API}/messages/${alice.id}`, { headers: auth(bob) })).status()).toBe(403);
});

test('a blocked user cannot re-open the door by asking to connect again', async ({ request }) => {
  const alice = await signUp(request, 'reconn-a');
  const bob = await signUp(request, 'reconn-b');
  await connect(request, alice, bob);
  await request.post(`${API}/messages/blocks/${bob.id}`, { headers: auth(alice) });

  const retry = await request.post(`${API}/messages/connections/${alice.id}/request`, {
    headers: auth(bob),
  });
  expect(retry.status()).toBe(403);
  expect((await send(request, bob, alice)).status()).toBe(403);
});

test('being connected to someone is not being connected to their buddies', async ({ request }) => {
  const alice = await signUp(request, 'chain-a');
  const bob = await signUp(request, 'chain-b');
  const cara = await signUp(request, 'chain-c');
  await connect(request, alice, bob);
  await connect(request, bob, cara);

  expect((await send(request, alice, cara)).status()).toBe(403);
});

test('a message cannot be sent as somebody else', async ({ request }) => {
  const alice = await signUp(request, 'spoof-a');
  const bob = await signUp(request, 'spoof-b');
  const mallory = await signUp(request, 'spoof-m');
  await connect(request, alice, bob);

  // Mallory holds a valid token and knows both ids. Two separate defences,
  // asserted separately because they fail differently.

  // 1. An identity field in the body is not ignored, it is rejected: the
  //    validator runs with `forbidNonWhitelisted`, so there is no quiet path
  //    where a `senderId` might one day be read.
  const spoofed = await request.post(`${API}/messages/${bob.id}`, {
    headers: auth(mallory),
    data: { body: 'hello', senderId: alice.id, from: alice.id },
  });
  expect(spoofed.status()).toBe(400);

  // 2. With a body the API does accept, Mallory is still only Mallory — the
  //    sender comes from the token, and Mallory is not connected to Bob.
  const honest = await request.post(`${API}/messages/${bob.id}`, {
    headers: auth(mallory),
    data: { body: 'hello' },
  });
  expect(honest.status()).toBe(403);
});

test('a message is refused without a token at all', async ({ request }) => {
  const alice = await signUp(request, 'anon-a');
  const bob = await signUp(request, 'anon-b');
  await connect(request, alice, bob);

  const res = await request.post(`${API}/messages/${bob.id}`, { data: { body: 'hello' } });
  expect(res.status()).toBe(401);
});

test('messages carry text and nothing else', async ({ request }) => {
  const alice = await signUp(request, 'text-a');
  const bob = await signUp(request, 'text-b');
  await connect(request, alice, bob);

  // No attachment field exists; the validator runs with forbidNonWhitelisted,
  // so an attempt to smuggle one is a 400 rather than a silently ignored key.
  const res = await request.post(`${API}/messages/${bob.id}`, {
    headers: auth(alice),
    data: { body: 'look at this', attachmentUrl: 'https://example.com/x.png' },
  });
  expect(res.status()).toBe(400);
});

/**
 * The UI path, once. Everything above proves the rules; this proves a real
 * person can actually get through them — ask, accept, and exchange a message.
 */
test('two people can connect from a check-in and exchange a message', async ({ browser }) => {
  const a = await browser.newContext();
  const b = await browser.newContext();
  const pageA = await a.newPage();
  const pageB = await b.newPage();

  const signUpUI = async (page: typeof pageA, tag: string) => {
    const email = `ui_${tag}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}@std.antalya.edu.tr`;
    await page.goto('/auth');
    await page.getByPlaceholder('Aylin Demir').fill(`UI ${tag}`);
    await page.getByPlaceholder('you@example.com').fill(email);
    await page.getByPlaceholder('At least 8 characters').fill('secret123');
    await page.getByRole('button', { name: /Create account/i }).click();
    await page.waitForURL(/\/dashboard$/, { timeout: 20_000 });
  };

  await signUpUI(pageA, 'anna');
  await signUpUI(pageB, 'bora');

  // B posts a check-in so A has a real account to find. The buddy list cannot
  // be used for this — it is seed data with no accounts behind it.
  const marker = `Buddy test ${Date.now()}`;
  await pageB.getByRole('link', { name: 'Social', exact: true }).click();
  await pageB.getByPlaceholder(/say what you.re up to/i).fill(marker);
  await pageB.getByRole('button', { name: /I.m Here/i }).click();
  await expect(pageB.getByText(marker)).toBeVisible();

  // A finds it and asks to connect.
  await pageA.getByRole('link', { name: 'Social', exact: true }).click();
  // The smallest element holding BOTH the message and its connect button —
  // filtering on the text alone lands on the paragraph, which has no button.
  const card = pageA
    .locator('div')
    .filter({ hasText: marker })
    .filter({ has: pageA.getByRole('button', { name: /Ask to connect/i }) })
    .last();
  await card.getByRole('button', { name: /Ask to connect/i }).click();
  await expect(pageA.getByText(/Request sent/i).first()).toBeVisible();

  // B accepts from the Messages page.
  await pageB.getByRole('link', { name: 'Messages', exact: true }).click();
  await pageB.getByRole('button', { name: 'Accept', exact: true }).first().click();

  // Now the conversation works, in both directions.
  await pageB.getByTestId('dm-connections').getByRole('button').first().click();
  await pageB.getByPlaceholder(/Write a message/i).fill('merhaba');
  await pageB.getByRole('button', { name: 'Send', exact: true }).click();
  await expect(pageB.getByTestId('dm-message').filter({ hasText: 'merhaba' })).toBeVisible();

  await pageA.getByRole('link', { name: 'Messages', exact: true }).click();
  await pageA.getByTestId('dm-connections').getByRole('button').first().click();
  // Arrives on the next poll rather than instantly — no socket here.
  await expect(pageA.getByTestId('dm-message').filter({ hasText: 'merhaba' })).toBeVisible({
    timeout: 15_000,
  });

  // And reporting it is one tap away, on the message itself.
  await expect(
    pageA.getByTestId('dm-message').filter({ hasText: 'merhaba' }).getByRole('button', { name: /Report/i }),
  ).toBeVisible();

  await a.close();
  await b.close();
});
