import { useEffect, useRef, useState } from 'react';
import type { Hub, Place, Tour } from '../types';
import { api } from '../services/api';
import { CURATED_TOURS } from '../mockData';
import { HUB_LABEL } from '../utils/format';
import { useT } from '../i18n';

/**
 * Free-text search over the 30 places (backend /places/search) plus curated
 * tours/activities (local). Debounced ~250ms. Selecting a place flies the map
 * to it; results offer "Add to Today's Path".
 */
export function SearchBar({
  onFocusPlace,
  onAddPlace,
  onUseTourHub,
}: {
  onFocusPlace: (place: Place) => void;
  onAddPlace: (placeId: string) => void;
  onUseTourHub: (hub: Hub) => void;
}) {
  const { t } = useT();
  const [q, setQ] = useState('');
  const [places, setPlaces] = useState<Place[]>([]);
  const [tours, setTours] = useState<Tour[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    if (timer.current) window.clearTimeout(timer.current);
    const query = q.trim();
    if (!query) {
      setPlaces([]);
      setTours([]);
      return;
    }
    setLoading(true);
    // Debounce: search ~250ms after the last keystroke, not every keypress.
    timer.current = window.setTimeout(async () => {
      const [p] = await Promise.all([api.searchPlaces(query).catch(() => [])]);
      const ql = query.toLowerCase();
      const tourMatches = CURATED_TOURS.filter(
        (tr) => tr.title.toLowerCase().includes(ql) || HUB_LABEL[tr.hub].toLowerCase().includes(ql),
      );
      setPlaces(p);
      setTours(tourMatches);
      setLoading(false);
    }, 250);
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [q]);

  const hasResults = places.length > 0 || tours.length > 0;

  return (
    <div className="relative">
      <input
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder={t('search.placeholder')}
        className="w-full rounded-xl border border-ink/10 bg-surface-2 px-4 py-2.5 text-sm text-ink placeholder:text-ink/40 outline-none focus:border-iznik"
      />

      {open && q.trim() && (
        <>
          <div className="fixed inset-0 z-[1040]" onClick={() => setOpen(false)} />
          <div className="absolute left-0 right-0 z-[1041] mt-1 max-h-96 overflow-y-auto rounded-xl border border-ink/10 bg-surface-2 shadow-2xl">
            {loading && <p className="px-4 py-3 text-sm text-ink/40">…</p>}
            {!loading && !hasResults && (
              <p className="px-4 py-4 text-sm text-ink/50">{t('search.empty')}</p>
            )}

            {places.map((p) => (
              <div key={p.placeId} className="flex items-center justify-between gap-2 border-b border-ink/5 px-4 py-2.5 hover:bg-ink/5">
                <button
                  onClick={() => {
                    onFocusPlace(p);
                    setOpen(false);
                  }}
                  className="flex-1 text-left"
                >
                  <span className="block text-sm font-semibold text-ink">{p.name}</span>
                  <span className="block text-xs text-ink/50">
                    {HUB_LABEL[p.hub]}
                    {p.rating !== null && ` · ⭐ ${p.rating}`}
                  </span>
                </button>
                <button
                  onClick={() => {
                    onAddPlace(p.placeId);
                    setOpen(false);
                  }}
                  className="flex-shrink-0 rounded-lg bg-iznik px-2 py-1 text-xs font-semibold text-white"
                >
                  {t('search.add')}
                </button>
              </div>
            ))}

            {tours.length > 0 && (
              <p className="border-b border-ink/5 bg-white px-4 py-1.5 text-[10px] uppercase tracking-wide text-ink/40">
                {t('search.tours')}
              </p>
            )}
            {tours.map((tr) => (
              <button
                key={tr.id}
                onClick={() => {
                  onUseTourHub(tr.hub);
                  setOpen(false);
                }}
                className="block w-full border-b border-ink/5 px-4 py-2.5 text-left hover:bg-ink/5"
              >
                <span className="block text-sm font-semibold text-ink">🎟️ {tr.title}</span>
                <span className="block text-xs text-ink/50">{HUB_LABEL[tr.hub]} · {tr.durationHours}h</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
