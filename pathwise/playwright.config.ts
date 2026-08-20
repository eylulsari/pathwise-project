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
  /**
   * One worker. Measured, not assumed.
   *
   * On a fresh database the full suite runs 2.6 min at three workers with one
   * failure and three flaky, and 3.0 min at one worker with nothing flaky at
   * all. The whole prize for the extra concurrency is around twenty seconds of
   * wall clock, and the price is tests that fail on load rather than on
   * behaviour — which costs far more than twenty seconds the moment somebody
   * has to work out whether a red run means the code broke or the box was
   * busy.
   *
   * Two was the compromise and it still leaked: this round caught
   * route-editing's autosave-debounce test going flaky at two workers.
   *
   * Every spec here drives one dev-mode backend and one Postgres. That, not
   * the runner, is the bottleneck, so extra workers only queue more work
   * against the same server.
   *
   * The retry stays for genuinely transient slowness — but it is no longer
   * doing the job of hiding contention.
   */
  workers: 1,
  retries: 1,
  /**
   * `list` for the terminal, `html` so a failure leaves something to read, and
   * `github` on CI so a failure is readable *without* the artifact.
   *
   * CI uploads `pathwise/playwright-report/` when the suite fails, and that
   * directory is produced by the html reporter — which was not enabled, so
   * every failed run annotated "No files were found with the provided path"
   * and uploaded nothing. A red E2E job was therefore undiagnosable from
   * outside the runner: the job log needs admin rights to download, and the
   * one artifact that would not have was never written.
   *
   * The artifact fixed half of that. It did not fix the other half: both the
   * job log and the artifact download require admin rights on this repo, so a
   * red run still says only "Process completed with exit code 1" to anyone
   * reading the checks API. The `github` reporter writes each failure as a
   * workflow annotation, and annotations are public — which is the difference
   * between knowing *which* test broke and guessing.
   *
   * `open: 'never'` keeps html from trying to launch a browser on the runner.
   */
  reporter: process.env.CI
    ? [['list'], ['github'], ['html', { open: 'never' }]]
    : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
});
