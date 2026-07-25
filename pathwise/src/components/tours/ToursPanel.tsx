import { useEffect, useMemo, useState } from 'react';
import type { Hub, Tour } from '../../types';
import { api } from '../../services/api';
import { HUB_LABEL, formatTry } from '../../utils/format';
import { useAuth } from '../../context/AuthContext';
import { useT } from '../../i18n';

const SOURCE_BADGE: Record<string, string> = {
  GetYourGuide: 'bg-orange-500/20 text-orange-300',
  TripAdvisor: 'bg-emerald/20 text-emerald',
  Pathwise: 'bg-violet/20 text-violet',
};

/** Curated + live tours. "Sync Live Tours" pulls partner-API tours; a tour
 *  opens a slide-over with its stops and "Set as Today's Itinerary". */
export function ToursPanel({ onUseTourHub }: { onUseTourHub: (hub: Hub) => void }) {
  const { isPremium } = useAuth();
  const { t } = useT();
  const [tours, setTours] = useState<Tour[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [synced, setSynced] = useState(false);
  const [detail, setDetail] = useState<Tour | null>(null);

  useEffect(() => {
    api.getCuratedTours().then(setTours);
  }, []);

  // Premium is ad-free: sponsored cards are hidden. Otherwise sponsored first.
  const visibleTours = useMemo(() => {
    const list = isPremium ? tours.filter((t) => !t.isSponsored) : [...tours];
    return list.sort((a, b) => Number(b.isSponsored) - Number(a.isSponsored));
  }, [tours, isPremium]);

  async function syncLive() {
    setSyncing(true);
    const live = await api.syncLiveTours();
    setTours((prev) => [...live, ...prev.filter((t) => !t.live)]);
    setSyncing(false);
    setSynced(true);
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-night-800 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-display text-sm font-bold">Curated & live tours</h3>
        <button
          onClick={syncLive}
          disabled={syncing}
          className="rounded-lg border border-violet/40 px-2.5 py-1 text-xs font-semibold text-cream hover:bg-violet/10"
        >
          {syncing ? '🔄 Syncing…' : synced ? '✓ Synced' : '🔄 Sync Live Tours'}
        </button>
      </div>

      <div className="space-y-2">
        {visibleTours.map((tour) => (
          <button
            key={tour.id}
            onClick={() => setDetail(tour)}
            className="w-full rounded-xl border border-white/10 bg-night p-3 text-left transition-colors hover:border-white/25"
          >
            <div className="flex items-start justify-between gap-2">
              <span className="font-semibold text-cream">{tour.title}</span>
              <span className="flex flex-shrink-0 gap-1">
                {tour.isSponsored && (
                  <span className="rounded-full bg-coral/20 px-2 py-0.5 text-[10px] font-semibold text-coral">
                    {t('tours.sponsored')}
                  </span>
                )}
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${SOURCE_BADGE[tour.source]}`}>
                  {tour.source}
                </span>
              </span>
            </div>
            <p className="mt-1 text-xs text-cream/50">
              {HUB_LABEL[tour.hub]} · {tour.durationHours}h · ⭐ {tour.rating} · {formatTry(tour.priceTry)}
            </p>
          </button>
        ))}
      </div>

      {/* Slide-over detail */}
      {detail && (
        <div className="fixed inset-0 z-[1100] flex justify-end bg-black/60" onClick={() => setDetail(null)}>
          <div className="h-full w-full max-w-md overflow-y-auto bg-night-800 p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between">
              <h3 className="font-display text-xl font-bold text-cream">{detail.title}</h3>
              <button onClick={() => setDetail(null)} className="text-cream/40 hover:text-cream">✕</button>
            </div>
            <p className="mt-1 text-sm text-cream/60">
              {HUB_LABEL[detail.hub]} · {detail.durationHours}h · ⭐ {detail.rating} · {formatTry(detail.priceTry)}
            </p>
            <span className={`mt-2 inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${SOURCE_BADGE[detail.source]}`}>
              via {detail.source}
            </span>
            {detail.isSponsored && (
              <span className="ml-2 rounded-full bg-coral/20 px-2 py-0.5 text-xs font-semibold text-coral">
                {t('tours.sponsored')}
              </span>
            )}

            <h4 className="mt-5 text-sm font-bold text-cream">Stops</h4>
            <ol className="mt-2 space-y-2">
              {detail.stopNames.map((s, i) => (
                <li key={i} className="flex items-center gap-3 rounded-lg bg-night px-3 py-2 text-sm text-cream/80">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent-gradient text-xs font-bold text-white">{i + 1}</span>
                  {s}
                </li>
              ))}
            </ol>

            <button
              onClick={() => {
                onUseTourHub(detail.hub);
                setDetail(null);
              }}
              className="btn-accent mt-6 w-full"
            >
              Set as Today’s Itinerary
            </button>
            {/* Affiliate booking link (mock ?ref=pathwise → revenue share). */}
            <a
              href={detail.affiliateUrl}
              target="_blank"
              rel="noopener noreferrer sponsored"
              className="mt-2 block w-full rounded-xl border border-emerald/40 py-3 text-center text-sm font-semibold text-emerald hover:bg-emerald/10"
            >
              {t('tours.reserve')}
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
