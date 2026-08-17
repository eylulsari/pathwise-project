import { useT } from '../i18n';

/**
 * Bookmark toggle for a place card.
 *
 * State is carried by the caller (`useSavedPlaces`) rather than fetched per
 * button: a list of twelve stops would otherwise make twelve identical
 * requests to learn one set of ids.
 */
export function SavePlaceButton({
  placeId,
  placeName,
  saved,
  onToggle,
  className = '',
}: {
  placeId: string;
  placeName: string;
  saved: boolean;
  onToggle: (placeId: string) => void;
  className?: string;
}) {
  const { t } = useT();
  const label = saved ? t('saved.remove') : t('saved.add');
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onToggle(placeId);
      }}
      // The name is in the accessible label because a screen reader hears these
      // one after another; "Save" twelve times says nothing about which place.
      aria-label={`${label}: ${placeName}`}
      aria-pressed={saved}
      title={label}
      data-testid={`save-place-${placeId}`}
      className={`text-xs font-semibold transition-colors ${
        saved ? 'text-terracotta' : 'text-ink/40 hover:text-terracotta'
      } ${className}`}
    >
      {saved ? '★' : '☆'} {label}
    </button>
  );
}
