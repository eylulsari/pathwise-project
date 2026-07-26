import { useState } from 'react';
import type { StartPoint, StartPointKind } from '../../types';
import { TRANSIT_HUBS } from '../../hubData';
import { useT } from '../../i18n';

/** Start/end point selector: GPS, Hotel, Transit hub/pier, pick on map, and
 *  (for the end point) Auto-suggest — the route engine picks the best finish.
 *  The choice sets the origin used to seed/anchor the route. */
export function StartPointSelector({
  value,
  onChange,
  titleKey = 'startPoint.title',
  showAuto = false,
}: {
  value: StartPoint | null;
  onChange: (sp: StartPoint | null) => void;
  titleKey?: string;
  /** When true, adds an "Auto-suggest" choice that clears the anchor. */
  showAuto?: boolean;
}) {
  const { t } = useT();
  const [kind, setKind] = useState<StartPointKind | 'auto'>(showAuto ? 'auto' : 'transit');
  const [hotel, setHotel] = useState('');
  const [gpsErr, setGpsErr] = useState<string | null>(null);

  const OPTIONS: { id: StartPointKind | 'auto'; label: string; icon: string }[] = [
    ...(showAuto ? [{ id: 'auto' as const, label: t('startPoint.auto'), icon: '✨' }] : []),
    { id: 'gps', label: t('startPoint.myLocation'), icon: '📍' },
    { id: 'hotel', label: t('startPoint.hotel'), icon: '🏨' },
    { id: 'transit', label: t('startPoint.transit'), icon: '🚇' },
    { id: 'map', label: t('startPoint.pickMap'), icon: '🗺️' },
  ];

  function useGps() {
    setGpsErr(null);
    if (!navigator.geolocation) {
      setGpsErr('Geolocation unavailable in this browser.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        onChange({
          kind: 'gps',
          label: 'My current location',
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        }),
      () => setGpsErr('Permission denied — pick another start option.'),
    );
  }

  return (
    <div className="rounded-2xl border border-ink/10 bg-surface-2 p-4">
      <h3 className="mb-2 font-display text-sm font-bold">{t(titleKey)}</h3>
      <div className={`grid gap-1.5 ${showAuto ? 'grid-cols-5' : 'grid-cols-4'}`}>
        {OPTIONS.map((o) => (
          <button
            key={o.id}
            onClick={() => {
              setKind(o.id);
              if (o.id === 'gps') useGps();
              if (o.id === 'auto') onChange(null); // clear → engine auto-picks
            }}
            className={`rounded-lg border px-1 py-2 text-center text-xs transition-colors ${
              kind === o.id
                ? 'border-sage bg-sage/15 text-ink'
                : 'border-ink/10 text-ink/70 hover:border-ink/25'
            }`}
          >
            <div className="text-base">{o.icon}</div>
            {o.label}
          </button>
        ))}
      </div>

      {kind === 'gps' && gpsErr && (
        <p className="mt-2 text-xs text-terracotta">{gpsErr}</p>
      )}

      {kind === 'hotel' && (
        <div className="mt-2 flex gap-1.5">
          <input
            value={hotel}
            onChange={(e) => setHotel(e.target.value)}
            placeholder={t('startPoint.hotelPlaceholder')}
            className="flex-1 rounded-lg border border-ink/10 bg-white px-2 py-1.5 text-sm outline-none focus:border-iznik"
          />
          <button
            onClick={() =>
              onChange({
                kind: 'hotel',
                label: hotel || t('startPoint.hotel'),
                // Demo geocode → Sultanahmet hotel cluster (would call a geocoder).
                lat: 41.0066,
                lng: 28.9773,
              })
            }
            className="rounded-lg bg-iznik/30 px-3 text-sm font-semibold"
          >
            {t('startPoint.set')}
          </button>
        </div>
      )}

      {kind === 'transit' && (
        <select
          onChange={(e) => {
            const h = TRANSIT_HUBS.find((t) => t.label === e.target.value);
            if (h) onChange({ kind: 'transit', label: h.label, lat: h.lat, lng: h.lng });
          }}
          defaultValue=""
          className="mt-2 w-full rounded-lg border border-ink/10 bg-white px-2 py-1.5 text-sm outline-none focus:border-iznik"
        >
          <option value="" disabled>{t('startPoint.choosePier')}</option>
          {TRANSIT_HUBS.map((t) => (
            <option key={t.label} value={t.label}>{t.label}</option>
          ))}
        </select>
      )}

      {kind === 'map' && (
        <p className="mt-2 text-xs text-ink/50">{t('startPoint.mapTip')}</p>
      )}

      {value && (
        <p className="mt-2 rounded-lg bg-sage/10 px-2 py-1.5 text-xs text-sage">
          {t('startPoint.startingFrom')}: <span className="font-semibold">{value.label}</span>
        </p>
      )}
    </div>
  );
}
