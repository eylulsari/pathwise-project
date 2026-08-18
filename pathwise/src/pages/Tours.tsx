import { useEffect, useRef, useState } from 'react';
import { AppHeader } from '../components/AppHeader';
import { api } from '../services/api';
import { TOURS, type Tour, type TourCategory } from '../data/tours';
import { useT } from '../i18n';

const CATEGORY_EMOJI: Record<TourCategory, string> = {
  bosphorus: '🚢',
  historic: '🏛️',
  walking: '🚶',
};

/**
 * Guided tours — referrals to GetYourGuide, nothing more.
 *
 * Two rules shape this page, and both are about not overclaiming:
 *
 *  1. **No price.** We do not have GetYourGuide's live prices, so there is
 *     nowhere on this page a number could go. The button says to go and look.
 *  2. **The referral is disclosed**, once at the top and again in the `rel`
 *     attribute. A paid link that reads as a neutral recommendation is the
 *     thing worth avoiding here.
 */
export default function Tours() {
  const { t } = useT();
  // Reward-points feedback. Local to the page: the link opens a new tab, so
  // the toast has to survive on the page behind it.
  const [toast, setToast] = useState<string | null>(null);
  const timer = useRef<number | null>(null);
  useEffect(() => () => {
    if (timer.current) window.clearTimeout(timer.current);
  }, []);

  /**
   * Opening a partner link earns the `tour_reserved` award.
   *
   * This is what that action was defined as — "booked a tour/activity through
   * a partner link" — and it was previously granted from the dashboard tours
   * panel, whose links were `.mock` placeholders that resolved nowhere. Paying
   * points for clicking a dead link was the objection; these links are real.
   *
   * ⚠️ A click is still not a confirmed booking — we cannot see GetYourGuide's
   * funnel. The server grants on intent and keeps the value small; see the
   * TODO in the analytics controller for where a partner postback would go.
   *
   * Never blocks the navigation: the anchor's default action runs, and a
   * failed award is silent because the user came here to look at a tour.
   */
  async function claimPoints(tour: Tour) {
    const award = await api.recordAffiliateClick(tour.id, 'GetYourGuide');
    if (!award || award.awarded <= 0) return;
    setToast(`🎉 +${award.awarded} ${t('points.earnedSuffix')}`);
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setToast(null), 3200);
  }

  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader />
      <main className="mx-auto w-full max-w-5xl flex-1 space-y-6 p-4 md:p-6">
        <div>
          <h1 className="font-display text-2xl font-bold">{t('tours.title')}</h1>
          <p className="text-sm text-ink/60">{t('tours.subtitle')}</p>
        </div>

        {/* Said before the cards, not in small print under them. */}
        <p className="rounded-xl bg-mustard/15 px-4 py-3 text-xs leading-relaxed text-ink/70">
          {t('tours.disclosure')}
        </p>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {TOURS.map((tour) => (
            <article
              key={tour.id}
              data-testid="tour-card"
              className="card-cream flex flex-col p-5"
            >
              <span className="mb-3 inline-flex w-fit items-center gap-1.5 rounded-full bg-iznik/10 px-2.5 py-1 text-[11px] font-semibold text-iznik">
                {CATEGORY_EMOJI[tour.category]} {t(`tours.category.${tour.category}`)}
              </span>
              <h2 className="font-display text-lg font-bold text-ink">
                {t(`tours.items.${tour.id}.title`)}
              </h2>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-ink/70">
                {t(`tours.items.${tour.id}.desc`)}
              </p>
              <a
                href={tour.url}
                target="_blank"
                // `sponsored` is what a paid referral is; `noopener` keeps the
                // opened tab from reaching back into this one.
                rel="noopener noreferrer sponsored"
                onClick={() => void claimPoints(tour)}
                className="btn-accent mt-4 rounded-xl px-4 py-2.5 text-center text-sm font-semibold"
              >
                {t('tours.cta')} ↗
              </a>
            </article>
          ))}
        </div>

        <p className="text-xs leading-relaxed text-ink/45">{t('tours.footnote')}</p>
        <p className="text-xs leading-relaxed text-ink/45">{t('points.tourHint')}</p>
      </main>

      {toast && (
        <div
          role="status"
          className="fixed bottom-24 start-1/2 z-[1200] -translate-x-1/2 rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white shadow-soft-lg"
        >
          {toast}
        </div>
      )}
    </div>
  );
}
