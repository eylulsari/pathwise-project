import type { Itinerary } from '../types';
import { museumPassSummary } from '../utils/museumPass';
import { formatTry } from '../utils/format';
import { useT } from '../i18n';

/**
 * "These stops are on the Museum Pass, and here is roughly what their tickets
 * would cost you separately."
 *
 * Every number here is hedged on purpose, and the hedging is the feature. The
 * entry fees are estimates — all five covered places in the dataset are
 * flagged approximate — and the pass price is not ours to quote, so the card
 * reports the gross figure, calls it an estimate in words as well as with a
 * "~", and sends the reader to the official site for the half we do not have.
 *
 * Printing a confident "you save 3,500 ₺" would be the same mistake as the
 * invented tour prices that were removed: a number the traveller could plan
 * around, assembled from figures nobody verified.
 */
export function MuseumPassCard({ itinerary }: { itinerary: Itinerary | null }) {
  const { t } = useT();
  const summary = museumPassSummary(itinerary);

  // Nothing covered today is not a state worth a card.
  if (summary.coveredNames.length === 0) return null;

  return (
    <section
      data-testid="museum-pass-card"
      className="rounded-2xl border border-mustard/40 bg-mustard/10 p-4"
    >
      <h3 className="font-display text-sm font-bold text-ink">
        🎫 {t('museumPass.title')}
      </h3>

      <p className="mt-1 text-xs text-ink/70">
        {t('museumPass.coveredCount', { count: summary.coveredNames.length })}
      </p>

      <ul className="mt-2 space-y-0.5">
        {summary.coveredNames.map((name) => (
          <li key={name} className="text-xs text-ink/80">
            · {name}
          </li>
        ))}
      </ul>

      {/* The headline figure. "~" and the word "estimated" both, because the
          tilde alone is easy to skim past. */}
      <p
        data-testid="museum-pass-total"
        className="mt-3 font-display text-base font-bold text-ink"
      >
        ~{formatTry(summary.estimatedFeesTry)}
      </p>
      <p className="text-xs font-semibold text-ink/70">
        {t('museumPass.estimatedLabel')}
      </p>

      {/* The half we cannot compute, said plainly rather than left implied. */}
      <p className="mt-2 text-xs leading-relaxed text-ink/55">
        {t('museumPass.notNetNote')}
      </p>
      <a
        href="https://muze.gov.tr/istanbul-museum-pass"
        target="_blank"
        rel="noopener noreferrer"
        className="mt-1 inline-block text-xs font-semibold text-iznik underline"
      >
        {t('museumPass.checkPrice')} ↗
      </a>

      {summary.uncoveredPaidStops > 0 && (
        <p className="mt-2 text-xs text-ink/45">
          {t('museumPass.uncoveredNote', { count: summary.uncoveredPaidStops })}
        </p>
      )}

      {summary.allApprox && (
        <p className="mt-2 text-[11px] leading-relaxed text-ink/45">
          ⚠️ {t('museumPass.approxWarning')}
        </p>
      )}
    </section>
  );
}
