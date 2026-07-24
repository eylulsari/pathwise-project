import { useCallback, useEffect, useState } from 'react';
import type { GenerateRouteRequest, Hub, Itinerary, StartPoint } from '../types';
import { api } from '../services/api';
import { AppHeader } from '../components/AppHeader';
import { MapView } from '../components/map/MapView';
import { TodayPath } from '../components/TodayPath';
import { RouteGenerator, type RouteConfig } from '../components/controls/RouteGenerator';
import { StartPointSelector } from '../components/controls/StartPointSelector';
import { SurvivalWidget } from '../components/SurvivalWidget';
import { TravelVibeQuiz, type QuizResult } from '../components/controls/TravelVibeQuiz';
import { MustVisitList } from '../components/controls/MustVisitList';
import { ToursPanel } from '../components/tours/ToursPanel';
import { AiAssistant } from '../components/ai/AiAssistant';
import { SplitBill } from '../components/SplitBill';
import { ExportRoute } from '../components/ExportRoute';
import { OfflineToggle } from '../components/OfflineToggle';

interface DayState {
  config: RouteConfig;
  mustVisitIds: string[];
  itinerary: Itinerary | null;
  loading: boolean;
  error: string | null;
}

const baseConfig = (hub: Hub): RouteConfig => ({
  hub,
  budgetTry: 2000,
  paceHours: 6,
  group: 'solo',
  interests: ['food', 'photo'],
  weather: 'sunny',
  startHour: 10,
});

// Three days, three different neighborhoods — deliberately not Sultanahmet-first.
const INITIAL_DAYS: DayState[] = [
  { config: baseConfig('kadikoy-moda'), mustVisitIds: [], itinerary: null, loading: true, error: null },
  { config: baseConfig('karakoy-galata'), mustVisitIds: [], itinerary: null, loading: false, error: null },
  { config: baseConfig('balat-fener'), mustVisitIds: [], itinerary: null, loading: false, error: null },
];

export default function Dashboard() {
  const [days, setDays] = useState<DayState[]>(INITIAL_DAYS);
  const [activeDay, setActiveDay] = useState(0);
  const [startPoint, setStartPoint] = useState<StartPoint | null>(null);
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);
  const [showQuiz, setShowQuiz] = useState(false);
  const [showMustVisit, setShowMustVisit] = useState(false);
  const [showSplitBill, setShowSplitBill] = useState(false);
  const [offline, setOffline] = useState(false);

  const day = days[activeDay];

  const patchDay = useCallback(
    (index: number, patch: Partial<DayState>) =>
      setDays((prev) => prev.map((d, i) => (i === index ? { ...d, ...patch } : d))),
    [],
  );

  const generateFor = useCallback(
    async (index: number, req: GenerateRouteRequest): Promise<Itinerary | null> => {
      patchDay(index, { loading: true, error: null });
      try {
        const itinerary = await api.generateRoute(req);
        patchDay(index, { itinerary, loading: false });
        setSelectedPlaceId(null);
        return itinerary;
      } catch (err) {
        patchDay(index, {
          loading: false,
          error: err instanceof Error ? err.message : 'Failed to generate route',
        });
        return null;
      }
    },
    [patchDay],
  );

  const buildRequest = (d: DayState): GenerateRouteRequest => ({
    mode: 'hub-budget',
    hub: d.config.hub,
    budgetTry: d.config.budgetTry,
    paceHours: d.config.paceHours,
    group: d.config.group,
    interests: d.config.interests,
    mustVisitIds: d.mustVisitIds,
    weather: d.config.weather,
    startHour: d.config.startHour,
  });

  // Generate the first day's default plan on mount.
  useEffect(() => {
    generateFor(0, buildRequest(INITIAL_DAYS[0]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function updateConfig(patch: Partial<RouteConfig>) {
    patchDay(activeDay, { config: { ...day.config, ...patch } });
  }

  function handleGenerate() {
    generateFor(activeDay, buildRequest(day));
  }

  function toggleMustVisit(id: string) {
    const next = day.mustVisitIds.includes(id)
      ? day.mustVisitIds.filter((x) => x !== id)
      : [...day.mustVisitIds, id];
    patchDay(activeDay, { mustVisitIds: next });
  }

  async function handleQuiz(result: QuizResult) {
    setShowQuiz(false);
    const req: GenerateRouteRequest = {
      mode: 'quiz-vibe',
      budgetTry: result.budgetTry,
      paceHours: day.config.paceHours,
      group: day.config.group,
      mustVisitIds: day.mustVisitIds,
      weather: day.config.weather,
      startHour: day.config.startHour,
      quiz: result,
    };
    const it = await generateFor(activeDay, req);
    // Reflect the quiz-derived hub/budget back into the visible controls.
    if (it) updateConfig({ hub: it.hub, budgetTry: result.budgetTry });
  }

  // AI "Add to Today's Path" → lock the place in and regenerate this day.
  function addToPath(placeId: string) {
    if (day.mustVisitIds.includes(placeId)) return;
    const next = [...day.mustVisitIds, placeId];
    patchDay(activeDay, { mustVisitIds: next });
    generateFor(activeDay, { ...buildRequest(day), mustVisitIds: next });
  }

  // Tour "Set as Today's Itinerary" → focus this day on the tour's hub.
  function useTourHub(hub: Hub) {
    const nextConfig = { ...day.config, hub };
    patchDay(activeDay, { config: nextConfig });
    generateFor(activeDay, { ...buildRequest({ ...day, config: nextConfig }) });
  }

  function switchDay(index: number) {
    setActiveDay(index);
    setSelectedPlaceId(null);
    if (!days[index].itinerary && !days[index].loading) {
      generateFor(index, buildRequest(days[index]));
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader />

      {offline && (
        <div className="bg-coral/20 px-4 py-1.5 text-center text-xs font-semibold text-coral">
          📴 Offline Mode — showing your cached plan. (UI demo only — no real caching.)
        </div>
      )}

      {/* Day tabs + action bar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-white/10 px-4 py-2">
        {days.map((_, i) => (
          <button
            key={i}
            onClick={() => switchDay(i)}
            className={`rounded-lg px-4 py-1.5 text-sm font-semibold transition-colors ${
              activeDay === i ? 'bg-accent-gradient text-white' : 'text-cream/60 hover:text-cream'
            }`}
          >
            Day {i + 1}
          </button>
        ))}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowSplitBill(true)}
            className="rounded-lg border border-white/10 px-3 py-1.5 text-sm font-semibold text-cream/80 hover:text-cream"
          >
            💰 Split Bill
          </button>
          {day.itinerary && <ExportRoute itinerary={day.itinerary} />}
          <OfflineToggle offline={offline} onToggle={() => setOffline((o) => !o)} />
        </div>
      </div>

      <div className="grid flex-1 grid-cols-1 gap-4 p-4 lg:grid-cols-2 xl:h-[calc(100vh-105px)] xl:grid-cols-[330px_minmax(340px,400px)_1fr]">
        {/* Left rail: controls */}
        <div className="space-y-4 overflow-y-auto pr-1">
          <RouteGenerator
            config={day.config}
            onChange={updateConfig}
            onGenerate={handleGenerate}
            generating={day.loading}
          />
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setShowQuiz(true)}
              className="rounded-xl border border-violet/40 px-3 py-2.5 text-sm font-semibold text-cream hover:bg-violet/10"
            >
              🎭 Vibe Quiz
            </button>
            <button
              onClick={() => setShowMustVisit(true)}
              className="rounded-xl border border-emerald/40 px-3 py-2.5 text-sm font-semibold text-cream hover:bg-emerald/10"
            >
              ⭐ Must-Visit {day.mustVisitIds.length > 0 && `(${day.mustVisitIds.length})`}
            </button>
          </div>
          <StartPointSelector value={startPoint} onChange={setStartPoint} />
          <ToursPanel onUseTourHub={useTourHub} />
          <SurvivalWidget />
        </div>

        {/* Middle: Today's Path */}
        <div className="overflow-y-auto pr-1">
          {day.loading && (
            <div className="flex h-40 items-center justify-center text-cream/50">
              <span className="animate-pulse">⚡ Generating your path…</span>
            </div>
          )}
          {day.error && (
            <div className="rounded-xl bg-fuchsia/15 p-4 text-sm text-fuchsia">
              {day.error}
              <button onClick={handleGenerate} className="ml-2 underline">Retry</button>
            </div>
          )}
          {day.itinerary && !day.loading && (
            <TodayPath
              itinerary={day.itinerary}
              selectedPlaceId={selectedPlaceId}
              onSelectPlace={setSelectedPlaceId}
              startPoint={startPoint}
            />
          )}
        </div>

        {/* Right: Map */}
        <div className="h-[60vh] xl:h-full">
          <MapView
            itinerary={day.itinerary}
            selectedPlaceId={selectedPlaceId}
            onSelectPlace={setSelectedPlaceId}
          />
        </div>
      </div>

      {showQuiz && <TravelVibeQuiz onComplete={handleQuiz} onClose={() => setShowQuiz(false)} />}
      {showMustVisit && (
        <MustVisitList
          selected={day.mustVisitIds}
          onToggle={toggleMustVisit}
          onClose={() => setShowMustVisit(false)}
        />
      )}
      {showSplitBill && <SplitBill onClose={() => setShowSplitBill(false)} />}

      {/* Floating AI assistant */}
      <AiAssistant onAddToPath={addToPath} />
    </div>
  );
}
