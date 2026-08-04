import { useEffect, useState } from 'react';
import type { PointAction, PointsSummary } from '../types';
import { api } from '../services/api';
import { useT } from '../i18n';

/**
 * Reward-points card for the profile.
 *
 * Shows the balance, an honest explanation of what points currently do
 * (nothing yet — they accumulate), and the price list for each earning action.
 *
 * ⚠️ Deliberately does NOT promise a specific discount or perk. Points are
 * accrual-only right now; the backend keeps a `point_transactions` ledger so a
 * real reward catalogue can be built on the balance later without a backfill.
 * TODO(rewards): when a catalogue exists, this card gains a "redeem" CTA and
 * the copy below (`points.whatForBody`) must be updated at the same time — it
 * currently tells the user there is nothing to spend them on.
 */

/** i18n key for each action, so a new action fails loudly rather than blankly. */
const ACTION_KEY: Record<PointAction, string> = {
  tour_reserved: 'points.action.tourReserved',
  referral: 'points.action.referral',
  route_completed: 'points.action.routeCompleted',
  review: 'points.action.review',
};

const ACTION_EMOJI: Record<PointAction, string> = {
  tour_reserved: '🎟️',
  referral: '👋',
  route_completed: '🏁',
  review: '✍️',
};

export function PointsCard() {
  const { t } = useT();
  const [summary, setSummary] = useState<PointsSummary | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    api.getPoints().then(setSummary).catch(() => setFailed(true));
  }, []);

  if (failed) return null; // points are a bonus surface — never block the page
  if (!summary) return null;

  const actions = Object.keys(summary.values) as PointAction[];

  return (
    <section className="rounded-2xl border border-ink/10 bg-surface-2 p-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-lg font-bold text-ink">{t('points.title')}</h2>
          <p className="text-xs text-ink/50">{t('points.balanceLabel')}</p>
        </div>
        <div
          className="rounded-2xl bg-accent-gradient px-5 py-3 text-center"
          data-testid="points-balance"
        >
          <div className="font-display text-2xl font-bold text-ink">{summary.points}</div>
          <div className="text-[10px] font-semibold uppercase tracking-wide text-ink/60">
            {t('points.unit')}
          </div>
        </div>
      </div>

      {/* "What are points for?" — honest about there being no catalogue yet. */}
      <div className="mt-4 rounded-xl bg-mustard/15 px-4 py-3">
        <p className="text-sm font-semibold text-ink">{t('points.whatFor')}</p>
        <p className="mt-1 text-xs leading-relaxed text-ink/70">{t('points.whatForBody')}</p>
      </div>

      <p className="mt-4 text-sm font-semibold text-ink">{t('points.howToEarn')}</p>
      <ul className="mt-2 grid gap-2 sm:grid-cols-2">
        {actions.map((action) => (
          <li
            key={action}
            className="flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-sm text-ink/80"
          >
            <span>{ACTION_EMOJI[action]}</span>
            <span className="flex-1">{t(ACTION_KEY[action])}</span>
            <span className="font-semibold text-iznik">+{summary.values[action]}</span>
          </li>
        ))}
      </ul>

      {summary.recent.length > 0 && (
        <>
          <p className="mt-4 text-sm font-semibold text-ink">{t('points.recent')}</p>
          <ul className="mt-2 space-y-1.5">
            {summary.recent.map((txn) => (
              <li key={txn.id} className="flex items-center gap-2 text-xs text-ink/60">
                <span>{ACTION_EMOJI[txn.action]}</span>
                <span className="flex-1">{t(ACTION_KEY[txn.action])}</span>
                <span className="text-ink/40">
                  {new Date(txn.createdAt).toLocaleDateString('en-GB', {
                    day: 'numeric',
                    month: 'short',
                  })}
                </span>
                <span className="font-semibold text-sage">+{txn.points}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
