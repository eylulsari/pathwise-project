import type { Place } from '../types';
import { hasVerifiedHours } from '../utils/format';
import { closingSoon, openStatus } from '../utils/openingHours';
import { useT } from '../i18n';

/**
 * Opening hours and the live open/closed state.
 *
 * ATTRIBUTION. Hours seeded from OpenStreetMap carry ODbL, so any surface that
 * shows them has to credit OSM. `openingHoursSource` existed on the record for
 * a whole release before anything rendered it, which meant ten places were
 * shipping OSM data uncredited. Routing every call site through this file is
 * what stops that happening again.
 *
 * ABSENCE. A place with no verified hours renders **nothing at all** — not a
 * placeholder, not a greyed-out clock. Most of the catalogue is in that state
 * because OSM simply has no `opening_hours` for a street or a small café, and
 * a row of "hours unknown" labels is noise that makes the cards worse. The
 * same applies to a schedule the parser cannot resolve: see `openingHours.ts`
 * for why silence beats a confident guess.
 */

/** Just the state — for place cards, where space is one line. */
export function OpenNowBadge({
  place,
  className = '',
}: {
  place: Pick<Place, 'openingHours'>;
  className?: string;
}) {
  const { t } = useT();
  const status = openStatus(place.openingHours);
  if (!status) return null;

  if (!status.open) {
    return (
      <span className={`font-semibold text-terracotta ${className}`}>
        ● {t('hours.closed')}
      </span>
    );
  }

  // The closing time is only worth the space when it is close enough to change
  // what someone does next; otherwise "open" is the whole answer.
  if (status.closesAt && closingSoon(status)) {
    return (
      <span className={`font-semibold text-mustard ${className}`}>
        ● {t('hours.closesAt')} {status.closesAt}
      </span>
    );
  }

  return (
    <span className={`font-semibold text-sage ${className}`}>
      ● {t('hours.openNow')}
    </span>
  );
}

/** Hours text + state + attribution — for detail surfaces. */
export function OpeningHours({
  place,
  className = 'text-xs text-ink/50',
}: {
  place: Pick<Place, 'openingHours' | 'openingHoursSource'>;
  className?: string;
}) {
  const { t } = useT();
  if (!hasVerifiedHours(place.openingHours)) return null;

  return (
    <p className={className}>
      🕒 {place.openingHours}
      <OpenNowBadge place={place} className="ms-2" />
      {place.openingHoursSource === 'OpenStreetMap' && (
        <span className="ms-1 text-ink/40">· {t('hours.osmSource')}</span>
      )}
    </p>
  );
}
