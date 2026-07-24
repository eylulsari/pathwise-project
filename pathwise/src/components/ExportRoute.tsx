import type { Itinerary } from '../types';
import { exportItineraryPdf, googleMapsUrl } from '../utils/export';

/** Export actions — simulated PDF download + a real Google Maps directions link. */
export function ExportRoute({ itinerary }: { itinerary: Itinerary }) {
  return (
    <div className="flex gap-2">
      <button
        onClick={() => exportItineraryPdf(itinerary)}
        className="rounded-lg border border-white/10 px-3 py-1.5 text-sm font-semibold text-cream/80 hover:text-cream"
      >
        📄 Export PDF
      </button>
      <a
        href={googleMapsUrl(itinerary)}
        target="_blank"
        rel="noopener noreferrer"
        className="rounded-lg border border-white/10 px-3 py-1.5 text-sm font-semibold text-cream/80 hover:text-cream"
      >
        🗺️ Open in Google Maps
      </a>
    </div>
  );
}
