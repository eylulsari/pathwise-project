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
   * One worker. Measured, not assumed — and the note that used to sit here
   * was wrong on both of its numbers.
   *
   * It claimed 2.6 min at three workers and 3.0 min at one, with "nothing
   * flaky at all". The first was taken while an unrelated process was
   * saturating the box. The second was one green run read as a guarantee; a
   * later eight-run sample had a failure in it. Re-measured on a clean
   * migration-built database, one worker runs all 143 tests in 6.6 min.
   *
   * Both figures are corrected here rather than quietly deleted, because a
   * comment that overstates its evidence is how the next person gets talked
   * out of investigating a real failure.
   *
   * The decision survives the correction. Concurrency buys a few minutes and
   * costs failures that are about load rather than behaviour, and working out
   * which kind of red a run is costs far more than the minutes. Two was the
   * compromise and it leaked: it is what caught route-editing's
   * autosave-debounce test going flaky.
   *
   * Every spec drives one dev-mode backend and one Postgres. That, not the
   * runner, is the bottleneck, so extra workers only queue more work against
   * the same server.
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
