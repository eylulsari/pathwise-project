import { useState } from 'react';
import type { StartPoint, StartPointKind } from '../../types';
import { TRANSIT_HUBS } from '../../hubData';
import { useT } from '../../i18n';

/** Start-point selector: GPS, Hotel, Transit hub/pier, or pick on map.
 *  The choice sets the origin used to estimate the first leg's distance/time. */
export function StartPointSelector({
  value,
  onChange,
}: {
  value: StartPoint | null;
  onChange: (sp: StartPoint | null) => void;
}) {
  const { t } = useT();
  const [kind, setKind] = useState<StartPointKind>('transit');
  const [hotel, setHotel] = useState('');
  const [gpsErr, setGpsErr] = useState<string | null>(null);

  const OPTIONS: { id: StartPointKind; label: string; icon: string }[] = [
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
    <div className="rounded-2xl border border-white/10 bg-night-800 p-4">
      <h3 className="mb-2 font-display text-sm font-bold">{t('startPoint.title')}</h3>
      <div className="grid grid-cols-4 gap-1.5">
        {OPTIONS.map((o) => (
          <button
            key={o.id}
            onClick={() => {
              setKind(o.id);
              if (o.id === 'gps') useGps();
            }}
            className={`rounded-lg border px-1 py-2 text-center text-xs transition-colors ${
              kind === o.id
                ? 'border-emerald bg-emerald/15 text-cream'
                : 'border-white/10 text-cream/70 hover:border-white/25'
            }`}
          >
            <div className="text-base">{o.icon}</div>
            {o.label}
          </button>
        ))}
      </div>

      {kind === 'gps' && gpsErr && (
        <p className="mt-2 text-xs text-fuchsia">{gpsErr}</p>
      )}

      {kind === 'hotel' && (
        <div className="mt-2 flex gap-1.5">
          <input
            value={hotel}
            onChange={(e) => setHotel(e.target.value)}
            placeholder={t('startPoint.hotelPlaceholder')}
            className="flex-1 rounded-lg border border-white/10 bg-night px-2 py-1.5 text-sm outline-none focus:border-violet"
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
            className="rounded-lg bg-violet/30 px-3 text-sm font-semibold"
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
          className="mt-2 w-full rounded-lg border border-white/10 bg-night px-2 py-1.5 text-sm outline-none focus:border-violet"
        >
          <option value="" disabled>{t('startPoint.choosePier')}</option>
          {TRANSIT_HUBS.map((t) => (
            <option key={t.label} value={t.label}>{t.label}</option>
          ))}
        </select>
      )}

      {kind === 'map' && (
        <p className="mt-2 text-xs text-cream/50">{t('startPoint.mapTip')}</p>
      )}

      {value && (
        <p className="mt-2 rounded-lg bg-emerald/10 px-2 py-1.5 text-xs text-emerald">
          {t('startPoint.startingFrom')}: <span className="font-semibold">{value.label}</span>
        </p>
      )}
    </div>
  );
}
