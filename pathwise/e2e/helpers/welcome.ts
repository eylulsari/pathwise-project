import { expect, type Page } from '@playwright/test';

/**
 * Read the greeting a new account gets, and get out of its way.
 *
 * Registering now lands on a short welcome panel — deliberately a modal, so
 * the three sentences are read before the day behind them is touched. Every
 * spec that creates an account therefore meets it, and its scrim
 * (`fixed inset-0 z-[1200]`) intercepts the first click each of them tries to
 * make. That is the modal doing its job, not a defect, so the fixture learns
 * the new first-run step rather than the product losing it.
 *
 * Only the sign-up path needs this. Signing in to an existing account goes
 * straight to the dashboard, and there is no greeting to dismiss.
 *
 * `welcome-start` rather than `welcome-skip`: it is the button a person
 * actually presses, so it is the one worth exercising on every run.
 *
 * `e2e/auth-flows.spec.ts` does NOT use this — it is the spec that tests the
 * greeting itself, and asserting through a helper that dismisses it would
 * leave nothing to assert.
 */
export async function dismissWelcome(page: Page): Promise<void> {
  const modal = page.getByTestId('welcome-modal');
  await expect(modal).toBeVisible({ timeout: 20_000 });
  await page.getByTestId('welcome-start').click();
  await expect(modal).toHaveCount(0);
}
