import { useEffect, useState } from 'react';
import type { Place, PlaceEnrichment } from '../types';
import { api } from '../services/api';
import { useT } from '../i18n';

/**
 * Live detail for a stop, layered over the curated data: a real Wikipedia
 * photo + summary (with the required attribution) for iconic places, and live
 * OSM tags (opening hours, wheelchair access, cuisine) from Overpass. Every
 * field is optional — if the backend returns null the panel simply hides it,
 * so a failed/slow external call never blocks the modal.
 */
export function PlaceEnrichmentPanel({ place }: { place: Place }) {
  const { t } = useT();
  const [data, setData] = useState<PlaceEnrichment | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    api
      .getPlaceEnrichment(place.placeId)
      .then((d) => alive && setData(d))
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [place.placeId]);

  if (failed || !data) return null;
  const { osm, wikipedia } = data;
  if (!osm && !wikipedia) return null;

  const wheelchairLabel =
    osm?.wheelchair === 'yes'
      ? `♿ ${t('enrich.wheelchairYes')}`
      : osm?.wheelchair === 'limited'
        ? `♿ ${t('enrich.wheelchairLimited')}`
        : osm?.wheelchair === 'no'
          ? `⚠ ${t('enrich.wheelchairNo')}`
          : null;

  return (
    <section className="mt-4 rounded-xl border border-iznik/20 bg-iznik/5 p-3">
      <h4 className="text-sm font-bold text-iznik">🌐 {t('enrich.title')}</h4>

      {wikipedia && (
        <div className="mt-2">
          {wikipedia.thumbnailUrl && (
            <img
              src={wikipedia.thumbnailUrl}
              alt={wikipedia.title}
              loading="lazy"
              className="mb-2 h-40 w-full rounded-lg object-cover"
            />
          )}
          <p className="text-sm leading-relaxed text-ink/80">{wikipedia.summary}</p>
          <a
            href={wikipedia.pageUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-1 inline-block text-[11px] font-semibold text-iznik hover:text-terracotta"
          >
            {/* Attribution is a licence requirement. */}
            {t('enrich.source')}: {wikipedia.attribution} ↗
          </a>
        </div>
      )}

      {osm && (osm.openingHours || wheelchairLabel || osm.cuisine) && (
        <div className="mt-3 space-y-1 border-t border-iznik/15 pt-2 text-xs text-ink/70">
          {osm.openingHours && (
            <p>
              <span className="font-semibold">🕒 {t('enrich.hours')}:</span> {osm.openingHours}
            </p>
          )}
          {wheelchairLabel && <p>{wheelchairLabel}</p>}
          {osm.cuisine && (
            <p>
              <span className="font-semibold">🍽 {t('enrich.cuisine')}:</span> {osm.cuisine}
            </p>
          )}
          <p className="text-[10px] text-ink/40">{t('enrich.osmSource')}</p>
        </div>
      )}
    </section>
  );
}
