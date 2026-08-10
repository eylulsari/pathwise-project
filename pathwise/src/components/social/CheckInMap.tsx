import { useMemo } from 'react';
import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet';
import L from 'leaflet';
import type { CheckIn } from '../../types';
import { formatAge, isLive } from '../../utils/presence';
import { useT } from '../../i18n';

/** Istanbul, framed to show both sides of the Bosphorus. */
const CENTER: [number, number] = [41.019, 28.98];

/**
 * A check-in pin.
 *
 * Live pins pulse; stale ones are a smaller, faded, static dot. The animation
 * is the whole point of the distinction — it has to be visible at a glance,
 * without reading a label — so the two states differ in motion, size AND
 * opacity rather than colour alone (colour alone would exclude anyone who
 * cannot distinguish it).
 */
function checkInPin(color: string, live: boolean): L.DivIcon {
  const size = live ? 18 : 12;
  return L.divIcon({
    className: '',
    html: `<div class="pw-checkin-pin${live ? ' pw-checkin-pin--live' : ''}" style="
      --pin-color:${color};
      width:${size}px;height:${size}px;
    "></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
  });
}

/**
 * "Who is out there right now" — a small map of the check-in feed.
 *
 * Deliberately its own map rather than an overlay on the dashboard's route
 * map: that one is already carrying the itinerary, the walking line and the
 * selected stop, and check-ins answer a different question.
 *
 * ⚠️ A pin marks where someone POSTED FROM, not where they are. Nothing here
 * tracks anyone — see the note in `utils/presence.ts`.
 */
export function CheckInMap({ checkIns }: { checkIns: CheckIn[] }) {
  const { t } = useT();

  // `now` is captured once per render so every pin on a given paint agrees
  // about what counts as live.
  const pins = useMemo(() => {
    const now = Date.now();
    return checkIns
      .filter((c): c is CheckIn & { lat: number; lng: number } =>
        typeof c.lat === 'number' && typeof c.lng === 'number',
      )
      .map((c) => ({ checkIn: c, live: isLive(c.createdAt, now), age: formatAge(c.createdAt, now) }));
  }, [checkIns]);

  const liveCount = pins.filter((p) => p.live).length;

  if (pins.length === 0) return null;

  return (
    <section>
      <div className="mb-3 flex flex-wrap items-baseline gap-2">
        <h2 className="font-display text-lg font-bold">{t('presence.mapTitle')}</h2>
        <span className="text-xs text-ink/50">
          🟢 {liveCount} {t('presence.activeNow')} · {t('presence.windowNote')}
        </span>
      </div>

      <div
        className="h-72 overflow-hidden rounded-2xl border border-ink/10"
        data-testid="checkin-map"
      >
        <MapContainer center={CENTER} zoom={12} scrollWheelZoom={false}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
            url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          />
          {pins.map(({ checkIn, live, age }) => (
            <Marker
              key={checkIn.id}
              position={[checkIn.lat, checkIn.lng]}
              icon={checkInPin(checkIn.traveler.avatarColor, live)}
            >
              <Popup>
                <span className="font-semibold">{checkIn.traveler.name}</span>
                <br />
                {checkIn.placeName} · {age}
                <br />
                <span className={live ? 'text-sage' : 'text-ink/40'}>
                  {live ? `🟢 ${t('presence.available')}` : t('presence.stale')}
                </span>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>

      <p className="mt-2 text-[11px] leading-relaxed text-ink/40">
        {t('presence.disclaimer')}
      </p>
    </section>
  );
}
