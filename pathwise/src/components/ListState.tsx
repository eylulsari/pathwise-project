import type { ReactNode } from 'react';
import type { LoadStatus } from '../hooks/useAsyncList';
import { useT } from '../i18n';

/**
 * Renders the not-yet-a-list states, and nothing at all once there is a list.
 *
 * Every list on the page says "loading", "failed" and "empty" the same way, so
 * a failure never borrows the wording of an empty result. The error line is
 * the only one that is coloured — a traveller should be able to tell at a
 * glance which of the three they are looking at without reading it.
 *
 * Returns `children` when there is something to show, so a caller wraps its
 * list rather than guarding it with three conditionals of its own.
 */
export function ListState({
  status,
  empty,
  emptyText,
  errorText,
  testId,
  children,
}: {
  status: LoadStatus;
  /** Whether the loaded list came back with no rows. */
  empty: boolean;
  /** What "no rows" means here — this sentence differs between lists. */
  emptyText: string;
  /**
   * Overrides the generic failure line where naming the thing helps — "could
   * not load the polls" tells someone which part of the page is missing, which
   * "could not load this" does not.
   */
  errorText?: string;
  testId: string;
  children: ReactNode;
}) {
  const { t } = useT();

  if (status === 'loading') {
    return (
      <p
        data-testid={`${testId}-loading`}
        className="rounded-xl border border-ink/10 bg-surface-2 px-4 py-6 text-center text-sm text-ink/45"
      >
        {t('list.loading')}
      </p>
    );
  }

  if (status === 'error') {
    return (
      <p
        data-testid={`${testId}-error`}
        className="rounded-xl border border-clay/30 bg-surface-2 px-4 py-6 text-center text-sm text-clay"
      >
        {errorText ?? t('list.error')}
      </p>
    );
  }

  if (empty) {
    return (
      <p
        data-testid={`${testId}-empty`}
        className="rounded-xl border border-dashed border-ink/15 px-4 py-6 text-center text-sm text-ink/50"
      >
        {emptyText}
      </p>
    );
  }

  return <>{children}</>;
}
