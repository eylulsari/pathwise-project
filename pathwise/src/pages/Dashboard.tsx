import { useCallback, useEffect, useRef, useState } from 'react';
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import type {
  GenerateRouteRequest,
  Hub,
  Itinerary,
  NearbySuggestion,
  Origin,
  Place,
  RebuildRouteRequest,
  Reservation,
  StartPoint,
} from '../types';
import { useNavigate } from 'react-router-dom';
import type { UsageInfo } from '../types';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useT } from '../i18n';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { cacheItineraries, loadCachedItineraries } from '../utils/offlineCache';
import { DayTab } from '../components/dnd/DayTab';
import { AppHeader } from '../components/AppHeader';
import { MapView } from '../components/map/MapView';
import { TodayPath } from '../components/TodayPath';
import { RouteGenerator, type RouteConfig } from '../components/controls/RouteGenerator';
import { StartPointSelector } from '../components/controls/StartPointSelector';
import { SurvivalWidget } from '../components/SurvivalWidget';
import { TravelVibeQuiz, type QuizResult } from '../components/controls/TravelVibeQuiz';
import { MustVisitList } from '../components/controls/MustVisitList';
import { ReservationModal } from '../components/controls/ReservationModal';
import { JournalModal } from '../components/JournalModal';
import { ToursPanel } from '../components/tours/ToursPanel';
import { AiAssistant } from '../components/ai/AiAssistant';
import { SplitBill } from '../components/SplitBill';
import { ExportRoute } from '../components/ExportRoute';
import { OfflineToggle } from '../components/OfflineToggle';
import { OfflineDownload } from '../components/OfflineDownload';
import { HUB_LABEL } from '../utils/format';

interface DayState {
  config: RouteConfig;
  mustVisitIds: string[];
  reservations: Reservation[];
  itinerary: Itinerary | null;
  undoStack: Itinerary[]; // A1 — last 5 states for undo
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
  { config: baseConfig('kadikoy-moda'), mustVisitIds: [], reservations: [], itinerary: null, undoStack: [], loading: true, error: null },
  { config: baseConfig('karakoy-galata'), mustVisitIds: [], reservations: [], itinerary: null, undoStack: [], loading: false, error: null },
  { config: baseConfig('balat-fener'), mustVisitIds: [], reservations: [], itinerary: null, undoStack: [], loading: false, error: null },
];

export default function Dashboard() {
  const { t } = useT();
  const { isPremium } = useAuth();
  const navigate = useNavigate();
  const [usage, setUsage] = useState<UsageInfo | null>(null);
  const [optimizeBlocked, setOptimizeBlocked] = useState(false);
  const [days, setDays] = useState<DayState[]>(INITIAL_DAYS);
  const [activeDay, setActiveDay] = useState(0);
  const [startPoint, setStartPoint] = useState<StartPoint | null>(null);
  const [endPoint, setEndPoint] = useState<StartPoint | null>(null);
  const [reordering, setReordering] = useState(false);
  const [undoVisible, setUndoVisible] = useState(false);
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );
  const [showQuiz, setShowQuiz] = useState(false);
  const [showMustVisit, setShowMustVisit] = useState(false);
  const [showSplitBill, setShowSplitBill] = useState(false);
  const [simulatedOffline, setSimulatedOffline] = useState(false);
  const online = useOnlineStatus();
  const isOffline = !online || simulatedOffline;
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [routeGeometry, setRouteGeometry] = useState<[number, number][] | null>(null);
  const [reservingPlace, setReservingPlace] = useState<Place | null>(null);
  const [journalPlace, setJournalPlace] = useState<Place | null>(null);
  const [suggestion, setSuggestion] = useState<NearbySuggestion | null>(null);
  const [dismissedSuggestions, setDismissedSuggestions] = useState<Set<string>>(new Set());

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
        setOptimizeBlocked(false);
        api.getUsage().then(setUsage).catch(() => {});
        return itinerary;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to generate route';
        // Free daily optimize limit hit → prompt upgrade instead of erroring.
        if (/limited to|Premium/i.test(msg)) {
          setOptimizeBlocked(true);
          patchDay(index, { loading: false });
          api.getUsage().then(setUsage).catch(() => {});
          return null;
        }
        patchDay(index, { loading: false, error: msg });
        return null;
      }
    },
    [patchDay],
  );

  const toOrigin = (p: StartPoint | null): Origin | undefined =>
    p ? { lat: p.lat, lng: p.lng, label: p.label } : undefined;

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
    startOrigin: toOrigin(startPoint),
    endOrigin: toOrigin(endPoint),
    reservations: d.reservations,
  });

  // ── Drag-and-drop manual reorder ──────────────────────────────────
  const realIdsOf = (d: DayState): string[] =>
    (d.itinerary?.stops ?? []).filter((s) => s.place).map((s) => s.place!.placeId);

  const rebuildReq = (d: DayState, ids: string[]): RebuildRouteRequest => ({
    placeIds: ids,
    hub: d.config.hub,
    budgetTry: d.config.budgetTry,
    paceHours: d.config.paceHours,
    group: d.config.group,
    weather: d.config.weather,
    startHour: d.config.startHour,
    startOrigin: toOrigin(startPoint),
    endOrigin: toOrigin(endPoint),
    reservations: d.reservations,
  });

  async function rebuildDay(index: number, ids: string[]) {
    setReordering(true);
    try {
      const it = await api.rebuildRoute(rebuildReq(days[index], ids));
      patchDay(index, { itinerary: it });
    } catch {
      /* keep the previous itinerary on failure */
    } finally {
      setReordering(false);
    }
  }

  async function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;
    const activeId = String(active.id);
    const overId = String(over.id);
    if (activeId === overId) return;

    recordUndo(activeDay); // A1 — snapshot before the drag reorder/move

    // Dropped onto a Day tab → move the stop to that day.
    if (overId.startsWith('day-')) {
      const target = Number(overId.slice(4));
      if (target === activeDay) return;
      const curIds = realIdsOf(days[activeDay]).filter((id) => id !== activeId);
      const tgtIds = [...realIdsOf(days[target]), activeId];
      await Promise.all([rebuildDay(activeDay, curIds), rebuildDay(target, tgtIds)]);
      setSelectedPlaceId(null);
      return;
    }

    // Reorder within the current day.
    const ids = realIdsOf(days[activeDay]);
    const oldIndex = ids.indexOf(activeId);
    const newIndex = ids.indexOf(overId);
    if (oldIndex < 0 || newIndex < 0) return;
    await rebuildDay(activeDay, arrayMove(ids, oldIndex, newIndex));
  }

  // On mount: if offline, hydrate the last cached plan instead of calling the
  // network; otherwise generate the default plan + load premium usage.
  // Guarded so React 18 StrictMode's double-invoke doesn't burn two optimizes.
  const didInit = useRef(false);
  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;
    if (!navigator.onLine) {
      loadCachedItineraries().then((cached) => {
        if (cached) {
          setDays((prev) => prev.map((d, i) => ({ ...d, itinerary: cached[i] ?? null, loading: false })));
        } else {
          patchDay(0, { loading: false });
        }
      });
      return;
    }
    generateFor(0, buildRequest(INITIAL_DAYS[0]));
    api.getUsage().then(setUsage).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist itineraries for offline use whenever any day's plan changes.
  useEffect(() => {
    cacheItineraries(days.map((d) => d.itinerary));
  }, [days]);

  // B3: a poll winner selected on the Social page → add it to Today's Path.
  useEffect(() => {
    const winner = localStorage.getItem('pathwise.pollWinner');
    if (winner && !isOffline) {
      localStorage.removeItem('pathwise.pollWinner');
      addToPath(winner);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [day.itinerary]);

  // Fetch real OSRM walking geometry whenever the visible itinerary changes.
  useEffect(() => {
    const stops = (day.itinerary?.stops ?? [])
      .map((s) => s.place)
      .filter((p): p is NonNullable<typeof p> => p !== null)
      .map((p) => ({ lat: p.lat, lng: p.lng }));
    if (stops.length < 2) {
      setRouteGeometry(null);
      return;
    }
    let active = true;
    setRouteGeometry(null); // clear stale line while fetching
    api.getRouteGeometry(stops).then((geo) => {
      if (active) setRouteGeometry(geo);
    });
    return () => {
      active = false;
    };
  }, [day.itinerary]);

  // Budget alert → Notification Center (B6), deduped per generated plan.
  const lastBudgetNotif = useRef<string | null>(null);
  useEffect(() => {
    const it = day.itinerary;
    if (it?.overBudget && lastBudgetNotif.current !== it.generatedAt) {
      lastBudgetNotif.current = it.generatedAt;
      api.emitNotification('budget');
    }
  }, [day.itinerary]);

  // Fetch a nearby "add this too" suggestion for the visible day.
  useEffect(() => {
    const ids = (day.itinerary?.stops ?? [])
      .filter((s) => s.place)
      .map((s) => s.place!.placeId);
    if (ids.length === 0) {
      setSuggestion(null);
      return;
    }
    let active = true;
    api.suggestNearby(day.config.hub, ids).then((s) => {
      if (!active) return;
      setSuggestion(s && !dismissedSuggestions.has(s.place.placeId) ? s : null);
    });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [day.itinerary, day.config.hub]);

  function updateConfig(patch: Partial<RouteConfig>) {
    patchDay(activeDay, { config: { ...day.config, ...patch } });
  }

  // ── Undo layer (A1) ───────────────────────────────────────────────
  // Snapshot the current plan before a user-initiated change (drag/optimize).
  function recordUndo(index: number) {
    const current = days[index].itinerary;
    if (!current) return;
    setDays((prev) =>
      prev.map((d, i) =>
        i === index ? { ...d, undoStack: [current, ...d.undoStack].slice(0, 5) } : d,
      ),
    );
    setUndoVisible(true);
    window.clearTimeout((recordUndo as unknown as { _t?: number })._t);
    (recordUndo as unknown as { _t?: number })._t = window.setTimeout(
      () => setUndoVisible(false),
      6000,
    );
  }

  function undo() {
    const stack = days[activeDay].undoStack;
    if (stack.length === 0) return;
    const [prevItinerary, ...rest] = stack;
    patchDay(activeDay, { itinerary: prevItinerary, undoStack: rest });
    setUndoVisible(false);
    setSelectedPlaceId(null);
  }

  function handleGenerate() {
    if (isOffline) return; // no network in offline mode
    recordUndo(activeDay); // A1 — snapshot before optimize
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

  // ── Reservations (pinned times) ───────────────────────────────────
  function saveReservation(r: Reservation) {
    const next = [...day.reservations.filter((x) => x.placeId !== r.placeId), r];
    const updated = { ...day, reservations: next };
    patchDay(activeDay, { reservations: next });
    setReservingPlace(null);
    // Re-plan so the day re-times around the pinned booking.
    generateFor(activeDay, buildRequest(updated));
  }

  function removeReservation(placeId: string) {
    const next = day.reservations.filter((x) => x.placeId !== placeId);
    const updated = { ...day, reservations: next };
    patchDay(activeDay, { reservations: next });
    setReservingPlace(null);
    generateFor(activeDay, buildRequest(updated));
  }

  // ── Mid-stop time anchor (A2) — one-click pin at the current time ─
  function toggleAnchor(place: Place, currentArrival: string) {
    const has = day.reservations.some((r) => r.placeId === place.placeId);
    const next = has
      ? day.reservations.filter((r) => r.placeId !== place.placeId)
      : [...day.reservations, { placeId: place.placeId, time: currentArrival }];
    recordUndo(activeDay);
    const updated = { ...day, reservations: next };
    patchDay(activeDay, { reservations: next });
    generateFor(activeDay, buildRequest(updated));
  }

  // ── "Add this too" suggestion ─────────────────────────────────────
  function addSuggestion() {
    if (!suggestion) return;
    const ids = [...realIdsOf(day), suggestion.place.placeId];
    setSuggestion(null);
    rebuildDay(activeDay, ids);
  }

  function dismissSuggestion() {
    if (suggestion) {
      setDismissedSuggestions((prev) => new Set(prev).add(suggestion.place.placeId));
    }
    setSuggestion(null);
  }

  async function saveCurrentPlan() {
    if (!day.itinerary) return;
    setSaveState('saving');
    try {
      const hubName = HUB_LABEL[day.itinerary.hub] ?? day.itinerary.hub;
      await api.saveTrip(`Day ${activeDay + 1} · ${hubName}`, day.itinerary);
      setSaveState('saved');
      setTimeout(() => setSaveState('idle'), 2500);
    } catch {
      setSaveState('idle');
    }
  }

  function switchDay(index: number) {
    // Free plan: only Day 1 is active — the rest lead to the Premium page.
    if (!isPremium && index > 0) {
      api.recordPaywall('day'); // A6 analytics
      navigate('/premium');
      return;
    }
    setActiveDay(index);
    setSelectedPlaceId(null);
    if (!days[index].itinerary && !days[index].loading) {
      generateFor(index, buildRequest(days[index]));
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader />

      {isOffline && (
        <div className="bg-coral/20 px-4 py-1.5 text-center text-xs font-semibold text-coral">
          {!online ? t('dash.offlineReal') : t('dash.offlineBanner')}
        </div>
      )}
      {optimizeBlocked && (
        <div className="flex items-center justify-center gap-2 bg-violet/20 px-4 py-1.5 text-center text-xs font-semibold text-cream">
          🔒 {usage?.optimizeLimit ?? 3}/{usage?.optimizeLimit ?? 3} — {t('premium.optimizeLeft')}: 0
          <button onClick={() => navigate('/premium')} className="underline">{t('premium.unlock')}</button>
        </div>
      )}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      {/* Day tabs + action bar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-white/10 px-4 py-2">
        {days.map((_, i) => (
          <DayTab
            key={i}
            index={i}
            active={activeDay === i}
            onClick={() => switchDay(i)}
            label={`${t('dash.day')} ${i + 1}`}
            locked={!isPremium && i > 0}
          />
        ))}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {usage && (
            <span className="rounded-lg border border-white/10 px-2.5 py-1 text-xs text-cream/60">
              {usage.optimizeLimit === null
                ? `💎 ${t('premium.unlimited')}`
                : `⚡ ${Math.max(0, usage.optimizeLimit - usage.optimizeUsed)} ${t('premium.optimizeLeft')}`}
            </span>
          )}
          <button
            onClick={saveCurrentPlan}
            disabled={!day.itinerary || saveState === 'saving' || isOffline}
            className={`rounded-lg border px-3 py-1.5 text-sm font-semibold transition-colors ${
              saveState === 'saved'
                ? 'border-emerald bg-emerald/20 text-emerald'
                : 'border-white/10 text-cream/80 hover:text-cream'
            }`}
          >
            {saveState === 'saved' ? `✓ ${t('dash.saved')}` : saveState === 'saving' ? t('dash.saving') : `💾 ${t('dash.savePlan')}`}
          </button>
          <button
            onClick={() => setShowSplitBill(true)}
            className="rounded-lg border border-white/10 px-3 py-1.5 text-sm font-semibold text-cream/80 hover:text-cream"
          >
            💰 {t('dash.splitBill')}
          </button>
          {day.itinerary && <ExportRoute itinerary={day.itinerary} />}
          <OfflineDownload days={days.map((d, i) => ({ label: `${t('dash.day')} ${i + 1}`, itinerary: d.itinerary }))} />
          <OfflineToggle offline={isOffline} onToggle={() => setSimulatedOffline((o) => !o)} />
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
            offline={isOffline}
          />
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setShowQuiz(true)}
              disabled={isOffline}
              className="rounded-xl border border-violet/40 px-3 py-2.5 text-sm font-semibold text-cream hover:bg-violet/10 disabled:opacity-40"
            >
              🎭 {t('dash.vibeQuiz')}
            </button>
            <button
              onClick={() => setShowMustVisit(true)}
              className="rounded-xl border border-emerald/40 px-3 py-2.5 text-sm font-semibold text-cream hover:bg-emerald/10"
            >
              ⭐ {t('dash.mustVisit')} {day.mustVisitIds.length > 0 && `(${day.mustVisitIds.length})`}
            </button>
          </div>
          <StartPointSelector value={startPoint} onChange={setStartPoint} />
          <StartPointSelector
            value={endPoint}
            onChange={setEndPoint}
            titleKey="endPoint.title"
            showAuto
          />
          <ToursPanel onUseTourHub={useTourHub} offline={isOffline} />
          <SurvivalWidget />
        </div>

        {/* Middle: Today's Path */}
        <div className="overflow-y-auto pr-1">
          {undoVisible && day.undoStack.length > 0 && (
            <div className="mb-3 flex items-center justify-between gap-2 rounded-xl border border-violet/40 bg-violet/10 px-3 py-2 text-sm">
              <span className="text-cream/90">✏️ {t('dash.routeUpdated')}</span>
              <div className="flex items-center gap-2">
                <button onClick={undo} className="rounded-lg bg-accent-gradient px-3 py-1 text-xs font-semibold text-white">
                  ↩ {t('dash.undo')}
                </button>
                <button onClick={() => setUndoVisible(false)} className="text-xs text-cream/50 hover:text-cream">✕</button>
              </div>
            </div>
          )}
          {day.loading && (
            <div className="flex h-40 items-center justify-center text-cream/50">
              <span className="animate-pulse">{t('dash.generating')}</span>
            </div>
          )}
          {day.error && (
            <div className="rounded-xl bg-fuchsia/15 p-4 text-sm text-fuchsia">
              {day.error}
              <button onClick={handleGenerate} className="ml-2 underline">{t('dash.retry')}</button>
            </div>
          )}
          {day.itinerary && !day.loading && (
            <TodayPath
              itinerary={day.itinerary}
              selectedPlaceId={selectedPlaceId}
              onSelectPlace={setSelectedPlaceId}
              startPoint={startPoint}
              reordering={reordering}
              onReserve={setReservingPlace}
              onJournal={setJournalPlace}
              onToggleAnchor={toggleAnchor}
              suggestion={suggestion}
              onAddSuggestion={addSuggestion}
              onDismissSuggestion={dismissSuggestion}
            />
          )}
        </div>

        {/* Right: Map */}
        <div className="h-[60vh] xl:h-full">
          <MapView
            itinerary={day.itinerary}
            selectedPlaceId={selectedPlaceId}
            onSelectPlace={setSelectedPlaceId}
            routeGeometry={routeGeometry}
          />
        </div>
      </div>
      </DndContext>

      {showQuiz && <TravelVibeQuiz onComplete={handleQuiz} onClose={() => setShowQuiz(false)} />}
      {showMustVisit && (
        <MustVisitList
          selected={day.mustVisitIds}
          onToggle={toggleMustVisit}
          onClose={() => setShowMustVisit(false)}
        />
      )}
      {showSplitBill && <SplitBill onClose={() => setShowSplitBill(false)} />}
      {reservingPlace && (
        <ReservationModal
          place={reservingPlace}
          existing={day.reservations.find((r) => r.placeId === reservingPlace.placeId)}
          onSave={saveReservation}
          onRemove={() => removeReservation(reservingPlace.placeId)}
          onClose={() => setReservingPlace(null)}
        />
      )}
      {journalPlace && (
        <JournalModal place={journalPlace} onClose={() => setJournalPlace(null)} />
      )}

      {/* Floating AI assistant */}
      <AiAssistant onAddToPath={addToPath} />
    </div>
  );
}
