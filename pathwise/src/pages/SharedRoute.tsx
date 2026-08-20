import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { IstanbulSilhouette } from '../components/IstanbulSilhouette';
import { LanguageToggle } from '../components/LanguageToggle';
import { useT } from '../i18n';
import { decodeShareLink } from '../utils/shareSummary';

/**
 * The other end of a shared link.
 *
 * Public, and it has to be: the person opening this has no account, which is
 * the entire point of sending them a link. There is nothing to protect here
 * either — the plan travels inside the URL fragment, so this page reads what
 * the sender already chose to hand over and never asks the server for
 * anything.
 *
 * Read-only, and it says so. A visitor who wants to change the day is offered
 * their own plan rather than an edit control that would have nowhere to save
 * to.
 */
export default function SharedRoute() {
  const { t } = useT();
  const [summary, setSummary] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    // Read on mount and on every hash change: a second link pasted into the
    // same tab is a navigation the router does not see.
    const read = () => {
      setSummary(decodeShareLink(window.location.hash));
      setChecked(true);
    };
    read();
    window.addEventListener('hashchange', read);
    return () => window.removeEventListener('hashchange', read);
  }, []);

  return (
    <div className="relative min-h-screen overflow-hidden bg-surface">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-gradient-to-br from-iznik/10 via-transparent to-sunset/15"
      />
      <IstanbulSilhouette className="pointer-events-none absolute bottom-0 start-0 h-40 w-full text-iznik/15" />

      <div className="relative mx-auto max-w-2xl px-5 py-10">
        <div className="flex items-center justify-between gap-3">
          <Link to="/" className="flex items-center gap-2">
            <span className="text-2xl">🗺️</span>
            <span className="font-display text-xl font-bold text-gradient">Pathwise</span>
          </Link>
          <LanguageToggle />
        </div>

        {!checked ? null : summary ? (
          <>
            <h1 className="mt-8 font-display text-3xl font-bold text-ink">
              {t('shared.title')}
            </h1>
            <p className="mt-1 text-sm text-ink/60">{t('shared.readOnly')}</p>

            <pre
              data-testid="shared-summary"
              className="mt-5 overflow-x-auto whitespace-pre-wrap rounded-2xl border border-ink/10 bg-surface-2 p-5 font-mono text-sm leading-relaxed text-ink/85 shadow-soft"
            >
              {summary}
            </pre>

            <Link
              to="/auth"
              data-testid="shared-cta"
              className="btn-accent mt-6 inline-block px-6 py-3 text-sm"
            >
              {t('shared.cta')}
            </Link>
          </>
        ) : (
          <div className="mt-16 text-center" data-testid="shared-empty">
            <p className="text-4xl">🧭</p>
            <h1 className="mt-3 font-display text-2xl font-bold text-ink">
              {t('shared.emptyTitle')}
            </h1>
            {/* Says which of the two it is — a link that was cut short in a
                chat window looks exactly like a typo from here, and "it did
                not work" would leave the reader with nothing to try. */}
            <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-ink/60">
              {t('shared.emptyBody')}
            </p>
            <Link to="/auth" className="btn-accent mt-6 inline-block px-6 py-3 text-sm">
              {t('shared.cta')}
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
