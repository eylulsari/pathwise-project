import { useEffect, useRef, useState } from 'react';
import type { Itinerary } from '../types';
import {
  downloadDay,
  estimateDaySizeMb,
  getDownloadedDays,
  removeDownload,
} from '../utils/offlineCache';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { useT } from '../i18n';

/** Selective offline download (A5): pick which day(s) to save offline, see the
 *  size, and get a "syncing" indicator when the connection returns. */
export function OfflineDownload({
  days,
}: {
  days: { label: string; itinerary: Itinerary | null }[];
}) {
  const { t } = useT();
  const online = useOnlineStatus();
  const [open, setOpen] = useState(false);
  const [downloaded, setDownloaded] = useState<Set<number>>(getDownloadedDays());
  const [syncing, setSyncing] = useState(false);
  const wasOffline = useRef(!online);

  // Offline → online transition with cached days → show a brief "syncing".
  useEffect(() => {
    if (online && wasOffline.current && downloaded.size > 0) {
      setSyncing(true);
      const id = window.setTimeout(() => setSyncing(false), 2500);
      wasOffline.current = false;
      return () => window.clearTimeout(id);
    }
    if (!online) wasOffline.current = true;
  }, [online, downloaded.size]);

  async function toggle(index: number, itinerary: Itinerary | null) {
    if (downloaded.has(index)) {
      await removeDownload(index);
    } else if (itinerary) {
      await downloadDay(index, itinerary);
    }
    setDownloaded(new Set(getDownloadedDays()));
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="rounded-lg border border-ink/10 px-3 py-1.5 text-sm font-semibold text-ink/80 hover:text-ink"
      >
        📥 {t('offlineDl.button')}{downloaded.size > 0 ? ` (${downloaded.size})` : ''}
        {syncing && <span className="ms-1 animate-pulse text-sage">🔄</span>}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-[1040]" onClick={() => setOpen(false)} />
          <div className="absolute end-0 z-[1041] mt-1 w-64 overflow-hidden rounded-xl border border-ink/10 bg-surface-2 shadow-xl">
            <p className="border-b border-ink/10 px-3 py-2 text-[10px] uppercase tracking-wide text-ink/40">
              {t('offlineDl.title')}
            </p>
            {syncing && (
              <p className="px-3 py-1.5 text-xs font-semibold text-sage">🔄 {t('offlineDl.syncing')}</p>
            )}
            {days.map((d, i) => {
              const size = estimateDaySizeMb(d.itinerary);
              const on = downloaded.has(i);
              return (
                <div key={i} className="flex items-center justify-between px-3 py-2 text-sm">
                  <span className="text-ink/80">
                    {d.label}
                    <span className="ms-1 text-ink/40">— {size} MB</span>
                  </span>
                  <button
                    onClick={() => toggle(i, d.itinerary)}
                    disabled={!d.itinerary}
                    className={`rounded-lg px-2 py-1 text-xs font-semibold disabled:opacity-30 ${
                      on ? 'bg-sage/20 text-sage' : 'bg-iznik/20 text-ink'
                    }`}
                  >
                    {on ? `✓ ${t('offlineDl.downloaded')}` : `⬇ ${t('offlineDl.download')}`}
                  </button>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
