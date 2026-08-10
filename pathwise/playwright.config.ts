import { defineConfig, devices } from '@playwright/test';

/**
 * E2E config. Runs against the already-running stack (docker compose up -d):
 *   frontend → http://localhost:5173,  backend → http://localhost:3000/api
 * Start the stack first, then `npm run e2e`.
 *
 * The default deliberately matches CI and `.env.example`, so the committed
 * config is the same everywhere.
 *
 * ⚠️ Local escape hatch: on Windows, `localhost` resolves to ::1 first, and the
 * WSL relay holding that IPv6 listener can go stale across a host sleep — the
 * containers stay healthy while every `localhost` request dies. That is a host
 * problem, not a repo one. Work around it *locally* with
 *   E2E_BASE_URL=http://127.0.0.1:5173
 * and a matching VITE_API_URL in your own (untracked) .env — do not pin IPv4
 * here, or CI and everyone else's localhost setup inherit a machine's quirk.
 * The backend already allows both origins, so either spelling passes CORS.
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
