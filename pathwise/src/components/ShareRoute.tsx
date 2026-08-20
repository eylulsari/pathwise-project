import { useMemo, useRef, useState } from 'react';
import type { DayShare } from '../types';
import { useT } from '../i18n';
import { buildShareSummary, encodeShareLink } from '../utils/shareSummary';

/**
 * The share sheet: a plan somebody can hand to the friend they are going with.
 *
 * TWO BUTTONS, AND WHAT SEPARATES THEM
 * The summary is plain text for a chat window. The link opens the same
 * summary in a browser at `/s`, and it works for a stranger because it
 * carries the plan in its own fragment — see shareSummary for why there is
 * nothing on the server to link to instead.
 *
 * THE TEXT IS SHOWN, NOT JUST COPIED
 * A copy button that reveals nothing asks for trust before it has earned any,
 * and on a phone the paste is the first time anyone sees what they sent. The
 * box above the buttons is exactly what lands in the clipboard, so it can be
 * read, corrected by hand, or selected manually when the clipboard API is
 * unavailable — which it is over plain http, and in a browser that has
 * refused the permission.
 */
export function ShareRoute({
  days,
  onClose,
}: {
  days: DayShare[];
  onClose: () => void;
}) {
  const { t } = useT();
  const [copied, setCopied] = useState<'link' | 'text' | null>(null);
  const [failed, setFailed] = useState(false);
  const timer = useRef<number | null>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);

  const summary = useMemo(
    () =>
      buildShareSummary(days, {
        heading: t('share.heading'),
        day: (n) => t('share.dayLine', { day: String(n) }),
        budget: (spent, of) => t('share.budgetLine', { spent, budget: of }),
        walking: (km) => t('share.walkingLine', { km }),
        stops: (stops, dayCount) =>
          t('share.stopsLine', { stops: String(stops), days: String(dayCount) }),
        lunch: t('share.lunch'),
        footer: t('share.footer'),
      }),
    [days, t],
  );

  const link = useMemo(
    () => encodeShareLink(summary, window.location.origin),
    [summary],
  );

  function flash(what: 'link' | 'text') {
    setCopied(what);
    setFailed(false);
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCopied(null), 2600);
  }

  /**
   * Copy, with a fallback that is not an apology.
   *
   * `navigator.clipboard` needs a secure context and a permission the browser
   * may simply refuse. When it does, selecting the text for the traveller
   * turns "it did not work" into one keystroke — the content is on screen
   * either way, which is the reason it is on screen.
   */
  async function copy(value: string, what: 'link' | 'text') {
    try {
      await navigator.clipboard.writeText(value);
      flash(what);
    } catch {
      setCopied(null);
      setFailed(true);
      textRef.current?.select();
    }
  }

  return (
    <div
      className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        className="card-cream max-h-[88vh] w-full max-w-lg overflow-y-auto p-6"
        data-testid="share-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 id="share-title" className="font-display text-xl font-bold text-ink">
              📤 {t('share.title')}
            </h3>
            <p className="mt-1 text-sm text-ink/60">{t('share.subtitle')}</p>
          </div>
          <button
            onClick={onClose}
            aria-label={t('share.close')}
            className="text-ink/40 hover:text-ink"
          >
            ✕
          </button>
        </div>

        {/* What will be pasted, before it is pasted. */}
        <textarea
          ref={textRef}
          readOnly
          value={summary}
          data-testid="share-summary"
          aria-label={t('share.previewLabel')}
          rows={12}
          className="mt-4 w-full resize-none rounded-xl border border-ink/10 bg-surface-2 p-3 font-mono text-xs leading-relaxed text-ink/80 outline-none focus:border-iznik"
        />

        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <button
            onClick={() => copy(summary, 'text')}
            data-testid="share-copy-summary"
            className="btn-accent w-full px-4 py-2.5 text-sm"
          >
            💬 {t('share.copySummary')}
          </button>
          <button
            onClick={() => link && copy(link, 'link')}
            disabled={!link}
            data-testid="share-copy-link"
            className="w-full rounded-xl border border-iznik/40 px-4 py-2.5 text-sm font-semibold text-iznik hover:bg-iznik/10 disabled:cursor-not-allowed disabled:opacity-40"
          >
            🔗 {t('share.copyLink')}
          </button>
        </div>

        {/* A plan long enough to break the link says so, rather than handing
            over a URL that a chat app will truncate into a dead one. */}
        {!link && (
          <p className="mt-2 text-xs text-ink/55" data-testid="share-link-too-long">
            {t('share.linkTooLong')}
          </p>
        )}

        {/* One live region, so a screen reader hears the result once rather
            than being told the whole sheet changed. */}
        <p
          role="status"
          aria-live="polite"
          data-testid="share-status"
          className={`mt-3 min-h-[1.25rem] text-sm font-semibold ${
            failed ? 'text-terracotta' : 'text-sage'
          }`}
        >
          {failed
            ? t('share.copyFailed')
            : copied === 'link'
              ? t('share.copiedLink')
              : copied === 'text'
                ? t('share.copiedSummary')
                : ''}
        </p>

        <p className="mt-1 text-[11px] leading-relaxed text-ink/45">
          {t('share.linkNote')}
        </p>
      </div>
    </div>
  );
}
