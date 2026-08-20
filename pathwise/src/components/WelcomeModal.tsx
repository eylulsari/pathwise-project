import { IstanbulSilhouette } from './IstanbulSilhouette';
import { useT } from '../i18n';

/**
 * The first thing a new account sees.
 *
 * Registration used to drop straight onto the dashboard, where a route was
 * already generating — so the first impression of Pathwise was a plan for a
 * day nobody had asked for, with no explanation of what had just been decided
 * or by whom.
 *
 * Three sentences and a way out. It is deliberately not a tour, not a
 * multi-step wizard, and not a form: the fastest way to understand this app is
 * to look at the day behind this panel, so the panel's job is to be read once
 * and dismissed. It never comes back: the dashboard reads the redirect's
 * ?welcome=1 into state and strips it from the URL on mount, so there is
 * nothing left for a reload or a back button to re-open.
 */
export function WelcomeModal({ onClose }: { onClose: () => void }) {
  const { t } = useT();

  return (
    <div
      className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        data-testid="welcome-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="welcome-title"
        className="card-cream relative w-full max-w-md overflow-hidden p-6 text-center"
        onClick={(e) => e.stopPropagation()}
      >
        {/* The city, not a stock photo of a suitcase. Same silhouette the sign-in
            panel uses, so the app looks like one place from the first screen. */}
        <IstanbulSilhouette className="pointer-events-none absolute inset-x-0 bottom-0 h-24 w-full text-iznik/15" />

        <div className="relative">
          <span className="text-3xl">🗺️</span>
          <h2 id="welcome-title" className="mt-2 font-display text-2xl font-bold text-ink">
            {t('welcome.title')}
          </h2>

          <p className="mt-3 text-sm leading-relaxed text-ink/75">{t('welcome.body1')}</p>
          <p className="mt-2 text-sm leading-relaxed text-ink/75">{t('welcome.body2')}</p>

          <button
            onClick={onClose}
            data-testid="welcome-start"
            className="btn-accent mt-6 w-full py-2.5 text-sm"
          >
            {t('welcome.start')}
          </button>
          <button
            onClick={onClose}
            data-testid="welcome-skip"
            className="mt-2 w-full text-xs font-medium text-ink/50 underline underline-offset-2 hover:text-ink/80"
          >
            {t('welcome.skip')}
          </button>
        </div>
      </div>
    </div>
  );
}
