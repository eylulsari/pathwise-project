import { defineConfig, devices } from '@playwright/test';

/**
 * E2E config. Runs against the already-running stack (docker compose up -d):
 *   frontend → http://127.0.0.1:5173,  backend → http://127.0.0.1:3000/api
 * Start the stack first, then `npm run e2e`.
 *
 * ⚠️ 127.0.0.1, not `localhost`, on purpose. Docker Desktop publishes ports on
 * both stacks, but `localhost` resolves to ::1 first on Windows, and the WSL
 * relay holding that IPv6 listener goes stale across a host sleep/resume — the
 * container stays healthy while every `localhost` request dies. Pinning IPv4
 * removes a whole class of "the stack is up but nothing responds" dead ends.
 * Override with E2E_BASE_URL if you need to point elsewhere.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  // Cap concurrency so the single dev backend isn't overwhelmed (sign-up
  // timeouts under heavy parallel load); one retry absorbs transient slowness.
  workers: 3,
  retries: 1,
  reporter: [['list']],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://127.0.0.1:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
});
