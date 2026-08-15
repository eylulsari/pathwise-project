import type { Place } from '../types';
import { hasVerifiedHours } from '../utils/format';
import { useT } from '../i18n';

/**
 * The one place opening hours are rendered, so two obligations are met once
 * instead of being remembered at every call site.
 *
 * ATTRIBUTION. Hours seeded from OpenStreetMap carry an ODbL obligation: any
 * surface that shows them has to credit OSM. `openingHoursSource` existed on
 * the record for a whole release before anything rendered it, which meant ten
 * places were shipping OSM data uncredited.
 *
 * ABSENCE. Most of the catalogue has no verified hours, and the dataset says so
 * with the literal string "Hours not verified". Printed raw next to a clock
 * emoji that reads like a database leak, so it is translated into a plain
 * sentence — and never fed to the open/closed indicator, which would otherwise
 * have to guess.
 */
export function OpeningHours({
  place,
  className = 'text-xs text-ink/50',
}: {
  place: Pick<Place, 'openingHours' | 'openingHoursSource'>;
  className?: string;
}) {
  const { t } = useT();

  if (!hasVerifiedHours(place.openingHours)) {
    return <p className={className}>{t('hours.unverified')}</p>;
  }

  return (
    <p className={className}>
      {place.openingHours}
      {place.openingHoursSource === 'OpenStreetMap' && (
        <span className="ml-1 text-ink/40">· {t('hours.osmSource')}</span>
      )}
    </p>
  );
}
