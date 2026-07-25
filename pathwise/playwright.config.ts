import { defineConfig, devices } from '@playwright/test';

/**
 * E2E config. Runs against the already-running stack (docker compose up -d):
 *   frontend → http://localhost:5173,  backend → http://localhost:3000/api
 * Start the stack first, then `npm run e2e`.
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
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
});
