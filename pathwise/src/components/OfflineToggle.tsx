/**
 * Offline Mode toggle — UI/banner level ONLY. This does NOT actually cache
 * anything or enable a service worker; it purely flips a banner to demonstrate
 * the intended UX. Real offline support would register a service worker and
 * cache the current itinerary + map tiles.
 */
export function OfflineToggle({
  offline,
  onToggle,
}: {
  offline: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className={`rounded-lg border px-3 py-1.5 text-sm font-semibold transition-colors ${
        offline
          ? 'border-terracotta bg-terracotta/20 text-terracotta'
          : 'border-ink/10 text-ink/70 hover:text-ink'
      }`}
      title="UI-only demo — does not really cache data"
    >
      {offline ? '📴 Offline' : '📶 Online'}
    </button>
  );
}
