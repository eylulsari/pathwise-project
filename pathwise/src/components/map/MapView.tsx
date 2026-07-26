import { useEffect, useMemo, useRef, useState } from 'react';
import {
  MapContainer,
  Marker,
  Popup,
  Polyline,
  TileLayer,
  useMap,
} from 'react-leaflet';
import L from 'leaflet';
import type { Itinerary, Place } from '../../types';
import { HUB_BY_ID } from '../../hubData';
import { isOpenNow } from '../../utils/format';

/** A numbered, hub-accented pin built as a divIcon (avoids the broken default
 *  Leaflet marker-image paths under bundlers). */
function pin(order: number | string, color: string, active: boolean): L.DivIcon {
  return L.divIcon({
    className: '',
    html: `<div style="
      background:${color};
      width:${active ? 34 : 28}px;height:${active ? 34 : 28}px;
      border-radius:50% 50% 50% 0;
      transform:rotate(-45deg);
      display:flex;align-items:center;justify-content:center;
      box-shadow:0 4px 10px rgba(61,50,41,.25);
      border:2px solid ${active ? '#FFFFFF' : 'rgba(255,255,255,.7)'};
    "><span style="transform:rotate(45deg);color:#fff;font-weight:700;font-size:13px;">${order}</span></div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 28],
    popupAnchor: [0, -28],
  });
}

/** Flies the map to the selected place, and keeps the map sized correctly when
 *  the layout changes (fullscreen toggle, panel resize). */
function MapController({
  center,
  selected,
  focus,
  resizeSignal,
}: {
  center: [number, number];
  selected: Place | null;
  focus: Place | null;
  resizeSignal: number;
}) {
  const map = useMap();

  // Leaflet renders at 0px if the container was hidden/zero-height at init or
  // the layout just changed — force a recalculation.
  useEffect(() => {
    const t = setTimeout(() => map.invalidateSize(), 200);
    return () => clearTimeout(t);
  }, [map, resizeSignal]);

  // A search focus takes priority; otherwise fly to the selected stop or hub.
  useEffect(() => {
    if (focus) map.flyTo([focus.lat, focus.lng], 16, { duration: 0.8 });
    else if (selected) map.flyTo([selected.lat, selected.lng], 16, { duration: 0.8 });
    else map.flyTo(center, 14, { duration: 0.6 });
  }, [map, selected, focus, center]);

  return null;
}

export function MapView({
  itinerary,
  selectedPlaceId,
  onSelectPlace,
  routeGeometry,
  focusPlace,
  onAddFocus,
}: {
  itinerary: Itinerary | null;
  selectedPlaceId: string | null;
  onSelectPlace: (placeId: string) => void;
  routeGeometry?: [number, number][] | null;
  focusPlace?: Place | null;
  onAddFocus?: (placeId: string) => void;
}) {
  const [fullscreen, setFullscreen] = useState(false);
  const [resizeSignal, setResizeSignal] = useState(0);
  const focusMarkerRef = useRef<L.Marker | null>(null);

  // Auto-open the search-focus popup when a result is selected.
  useEffect(() => {
    if (focusPlace && focusMarkerRef.current) {
      const t = setTimeout(() => focusMarkerRef.current?.openPopup(), 300);
      return () => clearTimeout(t);
    }
  }, [focusPlace]);

  // Bump the resize signal whenever fullscreen flips so the controller runs
  // invalidateSize after the CSS transition settles.
  useEffect(() => setResizeSignal((s) => s + 1), [fullscreen]);

  const places = useMemo(
    () =>
      (itinerary?.stops ?? [])
        .map((s) => s.place)
        .filter((p): p is Place => p !== null),
    [itinerary],
  );

  const hub = itinerary ? HUB_BY_ID[itinerary.hub] : HUB_BY_ID['kadikoy-moda'];
  const center = hub.center;
  const selected = places.find((p) => p.placeId === selectedPlaceId) ?? null;
  const line = places.map((p) => [p.lat, p.lng]) as [number, number][];

  return (
    <div
      className={
        fullscreen
          ? 'fixed inset-0 z-[1000]'
          : 'relative h-full w-full overflow-hidden rounded-2xl'
      }
    >
      <MapContainer
        center={center}
        zoom={14}
        scrollWheelZoom
        className="h-full w-full"
        zoomControl={false}
      >
        <TileLayer
          attribution='&copy; OpenStreetMap contributors &copy; CARTO'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />
        {/* Walking path between ordered stops. Prefer the real OSRM street
            geometry (solid); fall back to straight dashed lines when offline. */}
        {routeGeometry && routeGeometry.length > 1 ? (
          <Polyline
            positions={routeGeometry}
            pathOptions={{ color: hub.accent, weight: 4, opacity: 0.85 }}
          />
        ) : (
          line.length > 1 && (
            <Polyline
              positions={line}
              pathOptions={{ color: hub.accent, weight: 4, opacity: 0.8, dashArray: '2 8' }}
            />
          )
        )}
        {places.map((p, i) => {
          const open = isOpenNow(p.openingHours);
          return (
            <Marker
              key={p.placeId}
              position={[p.lat, p.lng]}
              icon={pin(i + 1, hub.accent, p.placeId === selectedPlaceId)}
              eventHandlers={{ click: () => onSelectPlace(p.placeId) }}
            >
              <Popup>
                <div className="min-w-[190px]">
                  <p className="font-display text-sm font-bold text-ink">{p.name}</p>
                  <p className="mt-0.5 text-xs text-ink/60">🕒 {p.openingHours}</p>
                  <p className="mt-1 text-xs text-ink/80">
                    🎟️ {p.entryFeeTry === 0 ? 'Free entry' : `₺${p.entryFeeTry}`}
                    {open === true && <span className="ml-2 font-semibold text-sage">● Open now</span>}
                    {open === false && <span className="ml-2 font-semibold text-terracotta">● Closed</span>}
                  </p>
                  <p className="mt-1 text-xs italic text-ink/70">💡 {p.localTip}</p>
                </div>
              </Popup>
            </Marker>
          );
        })}
        {/* Search focus — a temporary highlighted pin (may be off-route). */}
        {focusPlace && (
          <Marker
            ref={focusMarkerRef}
            position={[focusPlace.lat, focusPlace.lng]}
            icon={pin('★', '#4A7C82', true)}
          >
            <Popup>
              <div className="min-w-[190px]">
                <p className="font-display text-sm font-bold text-ink">{focusPlace.name}</p>
                <p className="mt-0.5 text-xs text-ink/60">🕒 {focusPlace.openingHours}</p>
                <p className="mt-1 text-xs italic text-ink/70">💡 {focusPlace.localTip}</p>
                {onAddFocus && (
                  <button
                    onClick={() => onAddFocus(focusPlace.placeId)}
                    className="mt-2 w-full rounded-lg bg-iznik py-1 text-xs font-semibold text-white"
                  >
                    ➕ Add to Today’s Path
                  </button>
                )}
              </div>
            </Popup>
          </Marker>
        )}
        <MapController center={center} selected={selected} focus={focusPlace ?? null} resizeSignal={resizeSignal} />
      </MapContainer>

      {/* Fullscreen toggle (top-right) */}
      <button
        onClick={() => setFullscreen((f) => !f)}
        className="absolute right-3 top-3 z-[1001] rounded-lg bg-surface-2/90 px-3 py-2 text-sm font-semibold text-ink shadow-lg backdrop-blur transition-colors hover:bg-surface-2"
        title={fullscreen ? 'Exit full screen' : 'Full screen'}
      >
        {fullscreen ? '✕ Close' : '⛶ Full screen'}
      </button>
    </div>
  );
}
