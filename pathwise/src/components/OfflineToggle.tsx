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
          ? 'border-coral bg-coral/20 text-coral'
          : 'border-white/10 text-cream/70 hover:text-cream'
      }`}
      title="UI-only demo — does not really cache data"
    >
      {offline ? '📴 Offline' : '📶 Online'}
    </button>
  );
}
