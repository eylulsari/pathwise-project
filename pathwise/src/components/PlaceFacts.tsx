import type { Place } from '../types';
import { HUB_LABEL, formatDuration } from '../utils/format';
import { useT } from '../i18n';

/**
 * What a place *is*, assembled from fields the record already holds.
 *
 * Fifty-nine places have neither a curated tip nor a Wikipedia article, and
 * until now their detail panel was simply empty. The fix is not to write
 * fifty-nine descriptions — nobody visited these places to write them, and an
 * invented sentence is exactly what this app has been removing. It is to show
 * the facts already sitting in the record and never rendered: what kind of
 * place it is, which neighbourhood, how long people typically spend, whether
 * it has a roof when it rains.
 *
 * Everything here is either a stored value or a direct restatement of one.
 * Nothing is a judgement — no "best", no "must-see", no crowd or queue claim —
 * because those are the fields left deliberately empty in the dataset.
 */
export function PlaceFacts({ place }: { place: Place }) {
  const { t } = useT();

  const chips: string[] = [];
  if (place.placeType) chips.push(t(`placeType.${place.placeType}`));
  chips.push(HUB_LABEL[place.hub] ?? place.hub);
  if (place.avgVisitMinutes > 0) {
    chips.push(`${t('facts.typicalVisit')} ${formatDuration(place.avgVisitMinutes)}`);
  }
  // Only stated when true: "not indoor" is not a useful thing to tell someone,
  // and the rain planner already treats absence as outdoor.
  if (place.isIndoor) chips.push(t('facts.indoor'));
  if (place.museumPass) chips.push(t('facts.museumPass'));

  return (
    <ul className="mt-2 flex flex-wrap gap-1.5">
      {chips.map((chip) => (
        <li
          key={chip}
          className="rounded-lg border border-ink/10 bg-ink/5 px-2 py-0.5 text-[11px] text-ink/60"
        >
          {chip}
        </li>
      ))}
    </ul>
  );
}
