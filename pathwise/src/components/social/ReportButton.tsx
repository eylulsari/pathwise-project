import { useState } from 'react';
import { api } from '../../services/api';
import { useT } from '../../i18n';

const REASONS = ['spam', 'offensive', 'misinformation', 'other'];

/** "🚩 Report" for social content (forum / check-in / community route). */
export function ReportButton({
  contentType,
  contentId,
}: {
  contentType: 'forum' | 'checkin' | 'route';
  contentId: string;
}) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(reason: string) {
    setBusy(true);
    try {
      await api.reportContent(contentType, contentId, reason);
      setDone(true);
      setOpen(false);
    } catch {
      /* ignore — best effort */
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return <span className="text-[10px] font-semibold text-emerald">✓ {t('report.thanks')}</span>;
  }

  return (
    <div className="relative inline-block">
      <button
        onClick={() => setOpen((o) => !o)}
        className="text-[10px] font-semibold text-cream/40 hover:text-fuchsia"
        title={t('report.report')}
      >
        🚩 {t('report.report')}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-[1040]" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-[1041] mt-1 w-44 overflow-hidden rounded-xl border border-white/10 bg-night-800 shadow-xl">
            <p className="px-3 py-2 text-[10px] uppercase tracking-wide text-cream/40">
              {t('report.reason')}
            </p>
            {REASONS.map((r) => (
              <button
                key={r}
                disabled={busy}
                onClick={() => submit(r)}
                className="block w-full px-3 py-2 text-left text-xs text-cream/80 hover:bg-white/5"
              >
                {t(`report.${r}`)}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
