import { useCallback, useEffect, useState } from 'react';
import type { GenerateRouteRequest, Itinerary } from '../types';
import { api } from '../services/api';
import { AppHeader } from '../components/AppHeader';
import { MapView } from '../components/map/MapView';
import { TodayPath } from '../components/TodayPath';

/**
 * Default day config used on first load. Deliberately NOT Sultanahmet — the
 * route generator (Phase 6) lets the user change every field.
 */
const DEFAULT_REQUEST: GenerateRouteRequest = {
  mode: 'hub-budget',
  hub: 'kadikoy-moda',
  budgetTry: 2000,
  paceHours: 6,
  group: 'solo',
  interests: ['food', 'photo'],
  mustVisitIds: [],
  weather: 'sunny',
  startHour: 10,
};

export default function Dashboard() {
  const [itinerary, setItinerary] = useState<Itinerary | null>(null);
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const generate = useCallback(async (req: GenerateRouteRequest) => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.generateRoute(req);
      setItinerary(result);
      setSelectedPlaceId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate route');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    generate(DEFAULT_REQUEST);
  }, [generate]);

  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader />

      <div className="grid flex-1 grid-cols-1 gap-4 p-4 lg:grid-cols-[minmax(360px,420px)_1fr] lg:h-[calc(100vh-61px)]">
        {/* Left: Today's Path */}
        <div className="overflow-y-auto pr-1">
          {loading && (
            <div className="flex h-40 items-center justify-center text-cream/50">
              <span className="animate-pulse">⚡ Generating your path…</span>
            </div>
          )}
          {error && (
            <div className="rounded-xl bg-fuchsia/15 p-4 text-sm text-fuchsia">
              {error}
              <button
                onClick={() => generate(DEFAULT_REQUEST)}
                className="ml-2 underline"
              >
                Retry
              </button>
            </div>
          )}
          {itinerary && !loading && (
            <TodayPath
              itinerary={itinerary}
              selectedPlaceId={selectedPlaceId}
              onSelectPlace={setSelectedPlaceId}
            />
          )}
        </div>

        {/* Right: Map */}
        <div className="h-[60vh] lg:h-full">
          <MapView
            itinerary={itinerary}
            selectedPlaceId={selectedPlaceId}
            onSelectPlace={setSelectedPlaceId}
          />
        </div>
      </div>
    </div>
  );
}
