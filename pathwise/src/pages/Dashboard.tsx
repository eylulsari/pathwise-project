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
  PersistedDay,
  Place,
  RebuildRouteRequest,
  Reservation,
  StartPoint,
} from '../types';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { UsageInfo } from '../types';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useT } from '../i18n';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { cacheItineraries, loadCachedItineraries } from '../utils/offlineCache';
import { DayTab } from '../components/dnd/DayTab';
import { SearchBar } from '../components/SearchBar';
import { AppHeader } from '../components/AppHeader';
import { MapView } from '../components/map/MapView';
import { SosButton } from '../components/SosButton';
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
import { DayCelebration } from '../components/DayCelebration';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { BADGES } from '../mockData';
import { earnBadge } from '../utils/badgeStore';
import { setDietary } from '../utils/travelerPreferences';
import { useSavedPlaces } from '../hooks/useSavedPlaces';

// The Passport badge each hub completes.
const HUB_BADGE: Record<string, string> = {
  sultanahmet: 'old-city-master',
  'eminonu-sirkeci': 'bazaar-navigator',
  'beyoglu-taksim': 'pasaj-explorer',
  'karakoy-galata': 'kahve-guru',
  'besiktas-bogaz': 'ferry-hopper',
  'ortakoy-bebek': 'bogaz-walker',
  'balat-fener': 'sunset-chaser',
  'kadikoy-moda': 'market-forager',
  uskudar: 'hill-climber',
  adalar: 'island-hopper',
};

/**
 * Record the hub's badge as earned and return it ONLY when this is a genuine
 * first unlock — the celebration card claims "Badge unlocked", so it must not
 * say that for a badge the passport already shows as earned.
 */
function unlockBadgeForHub(hub: string): { emoji: string; name: string } | null {
  const badge = BADGES.find((x) => x.id === HUB_BADGE[hub]);
  if (!badge || badge.earned) return null; // already in the catalogue as earned
  return earnBadge(badge.id) ? { emoji: badge.emoji, name: badge.name } : null;
}

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

/**
 * Trip length. Seven is the practical ceiling for one city and the ten hubs
 * cover it without repeating a neighbourhood — which matters, because each day
 * is generated from one hub's pool, so a repeated hub means repeated places.
 */
export const MIN_TRIP_DAYS = 1;
export const MAX_TRIP_DAYS = 7;
const DEFAULT_TRIP_DAYS = 3;

const emptyDay = (hub: Hub, loading: boolean): DayState => ({
  config: baseConfig(hub),
  mustVisitIds: [],
  reservations: [],
  itinerary: null,
  undoStack: [],
  loading,
  error: null,
});

/**
 * Fallback hub order for the days, used only until the server's day plan
 * arrives (and if it never does, offline). Deliberately not Sultanahmet-first,
 * and alternating shores the same way the server's rule does.
 */
const FALLBACK_HUBS: Hub[] = [
  'kadikoy-moda',
  'karakoy-galata',
  'uskudar',
  'balat-fener',
  'adalar',
  'beyoglu-taksim',
  'ortakoy-bebek',
];

const INITIAL_DAYS: DayState[] = FALLBACK_HUBS.slice(0, DEFAULT_TRIP_DAYS).map(
  (hub, i) => emptyDay(hub, i === 0),
);

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
  const { savedIds, toggle: toggleSaved } = useSavedPlaces();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );
  /**
   * The Vibe Quiz is a modal, and its open/closed state lives in the URL.
   *
   * It stays a modal because its whole job is to feed this page: the answers
   * become the generation inputs and the route is rebuilt underneath it. A
   * separate route would mean shipping the result back here, for no gain.
   *
   * What it lacked was a link. `?quiz=1` makes it shareable and bookmarkable,
   * and makes the browser's back button close it — none of which a `useState`
   * boolean can do. `replace` so a quiz opened and closed does not leave two
   * dashboard entries in the history.
   */
  const [searchParams, setSearchParams] = useSearchParams();
  const showQuiz = searchParams.get('quiz') === '1';
  const setShowQuiz = (open: boolean) =>
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (open) next.set('quiz', '1');
        else next.delete('quiz');
        return next;
      },
      { replace: true },
    );
  const [showMustVisit, setShowMustVisit] = useState(false);
  const [showSplitBill, setShowSplitBill] = useState(false);
  const [simulatedOffline, setSimulatedOffline] = useState(false);
  const online = useOnlineStatus();
  const isOffline = !online || simulatedOffline;
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [routeGeometry, setRouteGeometry] = useState<[number, number][] | null>(null);
  const [reservingPlace, setReservingPlace] = useState<Place | null>(null);
  const [journalPlace, setJournalPlace] = useState<Place | null>(null);
  const [searchFocus, setSearchFocus] = useState<Place | null>(null);
  const [suggestion, setSuggestion] = useState<NearbySuggestion | null>(null);
  const [dismissedSuggestions, setDismissedSuggestions] = useState<Set<string>>(new Set());
  // Transient toast (e.g. must-visit picks auto-applied to the route).
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number | null>(null);
  // Must-Visit selections at the moment the picker opened — compared on close
  // so we can auto-apply + report what changed without an extra Generate tap.
  const mustVisitSnapshot = useRef<string[]>([]);
  // Route-completion celebration: stops ticked off + a guard so the confetti
  // fires once per generated plan.
  const [visited, setVisited] = useState<Set<string>>(new Set());
  const [celebrating, setCelebrating] = useState(false);
  const celebratedFor = useRef<string | null>(null);
  // Set only when finishing the day genuinely unlocked a new Passport badge.
  const [unlockedBadge, setUnlockedBadge] = useState<{ emoji: string; name: string } | null>(null);

  const day = days[activeDay];

  const patchDay = useCallback(
    (index: number, patch: Partial<DayState>) =>
      setDays((prev) => prev.map((d, i) => (i === index ? { ...d, ...patch } : d))),
    [],
  );

  /**
   * Newest request per day wins, and older answers are discarded.
   *
   * Two generates for the same day can be in flight at once — the mount's
   * initial one and, right behind it, a one-shot instruction like "add this
   * poll winner" or a config change the traveller made while the first was
   * still running. Without sequencing, whichever the *network* returned last
   * won, so a slower first response would silently overwrite the day the
   * second one had built. That is what made the poll test look flaky: the
   * winner was added and then erased by an answer to a question nobody was
   * asking any more.
   */
  const requestSeq = useRef<Record<number, number>>({});

  const generateFor = useCallback(
    async (index: number, req: GenerateRouteRequest): Promise<Itinerary | null> => {
      const ticket = (requestSeq.current[index] ?? 0) + 1;
      requestSeq.current[index] = ticket;
      const stale = () => requestSeq.current[index] !== ticket;

      patchDay(index, { loading: true, error: null });
      try {
        const itinerary = await api.generateRoute(req);
        if (stale()) return itinerary;
        patchDay(index, { itinerary, loading: false });
        setSelectedPlaceId(null);
        setOptimizeBlocked(false);
        api.getUsage().then(setUsage).catch(() => {});
        return itinerary;
      } catch (err) {
        if (stale()) return null;
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

  /**
   * `from` defaults to the day in current state, but hydration has to pass it
   * explicitly: `setDays` has not applied yet at that point, so reading
   * `days[index]` there would rebuild the restored order against the *initial*
   * scaffold's hub and pace.
   */
  async function rebuildDay(index: number, ids: string[], from?: DayState) {
    setReordering(true);
    try {
      const it = await api.rebuildRoute(rebuildReq(from ?? days[index], ids));
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

  /**
   * Autosave the working plan.
   *
   * `hydrated` is the important part. Until the stored plan has been read back,
   * `days` still holds the initial empty scaffold — and saving that would
   * overwrite the user's real plan with three blank days on every page load.
   * The flag is set only after hydration has either restored a plan or decided
   * there is none.
   *
   * Debounced because edits arrive in bursts: a drag fires a state change, and
   * so does the rebuild that follows it a moment later.
   */
  /**
   * State, not a ref, because other effects have to *wait* for it.
   *
   * A ref would let the autosave read it, but it cannot wake an effect when it
   * flips — and the poll-winner and clone-hub handlers below must not run until
   * the stored plan has landed. They consume a one-shot instruction out of
   * localStorage; running one before hydration means `setDays(stored)`
   * overwrites the day it just built, with the instruction already deleted and
   * no way to retry it.
   */
  const [hydrated, setHydrated] = useState(false);

  const persistedDays = useCallback(
    (withItinerary: boolean): PersistedDay[] =>
      days.map((d) => ({
        config: d.config,
        mustVisitIds: d.mustVisitIds,
        reservations: d.reservations,
        placeIds: (d.itinerary?.stops ?? [])
          .filter((s) => s.place)
          .map((s) => s.place!.placeId),
        itinerary: withItinerary ? d.itinerary : null,
      })),
    [days],
  );

  /** True while an edit has been made but not yet persisted. */
  const unsaved = useRef(false);

  useEffect(() => {
    if (!hydrated || isOffline) return;
    unsaved.current = true;
    const handle = window.setTimeout(() => {
      void api
        .savePlan(persistedDays(true))
        .then(() => {
          unsaved.current = false;
        })
        .catch(() => {
          /* an autosave that fails must not interrupt planning */
        });
    }, 700);
    return () => window.clearTimeout(handle);
  }, [days, isOffline, persistedDays, hydrated]);

  /**
   * Flush the plan when the page is going away.
   *
   * The debounce above is cleared on unmount, so an edit followed within 700 ms
   * by a reload or a tab close never saved at all — and a normal fetch fired at
   * that moment is cancelled by the navigation anyway.
   *
   * The flush sends the stop order WITHOUT the cached itineraries. That is on
   * purpose: `keepalive` is the only thing that survives an unload and it caps
   * the body at 64 KB, which a week of full itineraries comfortably exceeds.
   * The order is the part that cannot be recomputed — hydration rebuilds the
   * rest from it. Losing the cache costs one round trip on the next load;
   * losing the order costs the traveller their edit.
   *
   * `unsaved` is what keeps that trade rare. Firing on every navigation would
   * strip the cached itineraries from a plan that was already safely stored,
   * so every return to the dashboard would rebuild all three days — the flush
   * would be destroying the cache it exists to protect.
   */
  useEffect(() => {
    const flush = () => {
      if (!hydrated || isOffline || !unsaved.current) return;
      void api.savePlan(persistedDays(false), { keepalive: true }).catch(() => {});
    };
    // `pagehide` fires on reload, close and bfcache navigation; the visibility
    // change covers mobile Safari backgrounding the tab without unloading it.
    const onHide = () => document.visibilityState === 'hidden' && flush();
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', onHide);
    return () => {
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', onHide);
    };
  }, [persistedDays, isOffline, hydrated]);

  // On mount: if offline, hydrate the last cached plan instead of calling the
  // network; otherwise restore the saved plan, or generate a fresh one.
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

    // A stored plan wins over generating a new one: it holds edits the traveller
    // made by hand, and regenerating would quietly throw them away. Only when
    // there is nothing stored does the dashboard build a plan from scratch.
    void api
      .getPlan()
      .then((stored) => {
        if (stored && stored.length > 0) {
          setDays(
            stored.map((d) => ({
              config: d.config,
              mustVisitIds: d.mustVisitIds ?? [],
              reservations: d.reservations ?? [],
              itinerary: d.itinerary ?? null,
              undoStack: [],
              loading: false,
              error: null,
            })),
          );
          // A day saved by the unload flush carries the stop order but no
          // cached itinerary. Rebuilding from that order restores exactly the
          // day the traveller left; without this it would render as empty and
          // the edit would look lost even though it was saved.
          stored.forEach((d, i) => {
            if (!d.itinerary && (d.placeIds?.length ?? 0) > 0) {
              void rebuildDay(i, d.placeIds, {
                config: d.config,
                mustVisitIds: d.mustVisitIds ?? [],
                reservations: d.reservations ?? [],
                itinerary: null,
                undoStack: [],
                loading: false,
                error: null,
              });
            }
          });
          return true;
        }
        return false;
      })
      .catch(() => false)
      .then((restored) => {
        setHydrated(true);
        if (restored) return;
        generateFor(0, buildRequest(INITIAL_DAYS[0]));
        planInitialHubs();
      });
    api.getUsage().then(setUsage).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Ask the server which hubs the days should cover. Only day 1 has been
   * generated at this point, so re-hubbing the untouched later days costs
   * nothing — and day 1 keeps whatever it already started on.
   *
   * Only runs for a freshly generated plan. A restored plan already carries the
   * hubs the traveller settled on, and re-hubbing it would move their days.
   */
  function planInitialHubs() {
    api
      .getDayPlan(INITIAL_DAYS.length)
      .then((hubs) => {
        if (hubs.length === 0) return;
        setDays((prev) =>
          prev.map((d, i) =>
            i === 0 || !hubs[i] || d.itinerary
              ? d
              : { ...d, config: { ...d.config, hub: hubs[i] } },
          ),
        );
      })
      .catch(() => {});
  }

  /**
   * Change the length of the trip.
   *
   * Growing asks the server which hubs the new days should cover, so the week
   * keeps alternating shores instead of repeating a neighbourhood — and a
   * repeated neighbourhood would mean repeated places, since every day is
   * generated from one hub's pool.
   *
   * Shrinking drops days off the end. Days the traveller has already edited are
   * never re-hubbed: `d.itinerary` is the marker that a day is theirs now.
   */
  async function setTripLength(next: number) {
    const target = Math.min(MAX_TRIP_DAYS, Math.max(MIN_TRIP_DAYS, next));
    if (target === days.length) return;

    if (target < days.length) {
      setDays((prev) => prev.slice(0, target));
      setActiveDay((cur) => Math.min(cur, target - 1));
      return;
    }

    const hubs = await api.getDayPlan(target).catch(() => FALLBACK_HUBS);
    setDays((prev) => {
      const grown = [...prev];
      for (let i = prev.length; i < target; i++) {
        grown.push(emptyDay(hubs[i] ?? FALLBACK_HUBS[i % FALLBACK_HUBS.length], false));
      }
      return grown.map((d, i) =>
        i < prev.length || d.itinerary
          ? d
          : { ...d, config: { ...d.config, hub: hubs[i] ?? d.config.hub } },
      );
    });
  }

  // Persist itineraries for offline use whenever any day's plan changes.
  useEffect(() => {
    cacheItineraries(days.map((d) => d.itinerary));
  }, [days]);

  /**
   * B3: a poll winner selected on the Social page → add it to Today's Path.
   *
   * Gated on `hydrated`, and that gate is load-bearing. The winner is a
   * one-shot instruction: it is read out of localStorage and deleted in the
   * same breath. Run before the stored plan lands and `setDays(stored)`
   * overwrites the day this just built — with the instruction already gone and
   * nothing left to retry from. It looked like flakiness because it is a race,
   * and it got worse the slower the machine.
   */
  useEffect(() => {
    if (!hydrated) return;
    const winner = localStorage.getItem('pathwise.pollWinner');
    if (winner && !isOffline) {
      localStorage.removeItem('pathwise.pollWinner');
      addToPath(winner);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [day.itinerary, hydrated]);

  // "Clone This Route" on the Social page → rebuild Today's Path on that hub.
  // Same one-shot instruction, same race, same gate as the poll winner above.
  useEffect(() => {
    if (!hydrated) return;
    const hub = localStorage.getItem('pathwise.cloneHub');
    if (hub && !isOffline) {
      localStorage.removeItem('pathwise.cloneHub');
      applyTourHub(hub as Hub);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated]);

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
    api
      .suggestNearby(day.config.hub, ids)
      .then((s) => {
        if (!active) return;
        setSuggestion(s && !dismissedSuggestions.has(s.place.placeId) ? s : null);
      })
      // A missing suggestion is not an error worth surfacing — the panel just
      // stays hidden. Without this an unhandled rejection reaches the console.
      .catch(() => {
        if (active) setSuggestion(null);
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [day.itinerary, day.config.hub]);

  // Reset the visited ticks whenever the day changes or a new plan is generated.
  useEffect(() => {
    setVisited(new Set());
    setCelebrating(false);
    setUnlockedBadge(null);
  }, [activeDay, day.itinerary?.generatedAt]);

  // Every real stop ticked → fire the completion celebration (once per plan).
  useEffect(() => {
    const it = day.itinerary;
    if (!it) return;
    const realIds = it.stops.filter((s) => s.place).map((s) => s.place!.placeId);
    if (realIds.length === 0) return;
    if (realIds.every((id) => visited.has(id)) && celebratedFor.current !== it.generatedAt) {
      celebratedFor.current = it.generatedAt;
      // Persist the unlock here, at the moment the day is actually completed.
      setUnlockedBadge(unlockBadgeForHub(it.hub));
      setCelebrating(true);
      // …and claim the reward points. The server throttles this to once a day
      // and answers `awarded: 0` when it declines, so a repeat completion just
      // shows no toast instead of an error.
      void api.awardRouteCompletion().then((award) => {
        if (award && award.awarded > 0) {
          showToast(`🎉 +${award.awarded} ${t('points.earnedSuffix')}`);
        }
      });
    }
    // `t` is a dependency only because the toast is translated; the
    // once-per-plan guard above means a language switch cannot re-fire this.
  }, [visited, day.itinerary, t]);

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

  function toggleVisited(placeId: string) {
    setVisited((prev) => {
      const next = new Set(prev);
      next.has(placeId) ? next.delete(placeId) : next.add(placeId);
      return next;
    });
  }

  function showToast(msg: string) {
    setToast(msg);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 3200);
  }

  function openMustVisit() {
    mustVisitSnapshot.current = day.mustVisitIds;
    setShowMustVisit(true);
  }

  // Auto-apply the picks on close (no extra Generate tap) and toast the result.
  function closeMustVisit() {
    setShowMustVisit(false);
    const before = mustVisitSnapshot.current;
    const after = day.mustVisitIds;
    const added = after.filter((id) => !before.includes(id));
    const removed = before.filter((id) => !after.includes(id));
    if (added.length === 0 && removed.length === 0) return;
    if (isOffline || !day.itinerary) return; // can't re-plan offline / with no plan
    recordUndo(activeDay);
    generateFor(activeDay, buildRequest(day));
    if (added.length > 0) {
      const suffix = added.length === 1 ? t('dash.stopAdded') : t('dash.stopsAdded');
      showToast(`✅ ${t('dash.mustVisitApplied')} · ${added.length} ${suffix}`);
    } else {
      showToast(`✅ ${t('dash.routeUpdated')}`);
    }
  }

  async function handleQuiz(result: QuizResult) {
    setShowQuiz(false);
    // The dietary answer is stored, not sent: it goes to the assistant with
    // each chat turn, and the route engine never sees it. See
    // `utils/travelerPreferences.ts` for why.
    setDietary(result.dietary);
    const req: GenerateRouteRequest = {
      mode: 'quiz-vibe',
      budgetTry: result.budgetTry,
      paceHours: day.config.paceHours,
      group: result.party,
      mustVisitIds: day.mustVisitIds,
      weather: day.config.weather,
      startHour: day.config.startHour,
      quiz: {
        mood: result.mood,
        pace: result.pace,
        budgetTry: result.budgetTry,
        party: result.party,
        walkingTolerance: result.walkingTolerance,
        visitedBefore: result.visitedBefore,
      },
    };
    const it = await generateFor(activeDay, req);
    // Reflect the quiz-derived hub/budget/group back into the visible controls,
    // so the form agrees with the day the quiz just built rather than showing
    // a group the route was not made for.
    if (it) updateConfig({ hub: it.hub, budgetTry: result.budgetTry, group: result.party });
    // The quiz is also the only place the app learns the user's travel style,
    // so feed it into the profile that drives buddy matching. Fire-and-forget:
    // it must never delay or fail the route the user actually asked for. The
    // server unions the derived tags in, so hand-picked ones survive.
    void api.applyQuizTravelStyles(result);
  }

  /**
   * Add a place to today — from search, the AI panel, or a poll result.
   *
   * Two paths, and the difference matters. With a day already on screen the
   * place is appended to the existing order and the day is *rebuilt*, so every
   * stop the traveller dragged into position stays where they put it. A full
   * regenerate would re-solve the day and silently undo their arrangement,
   * which is the behaviour this had before and the reason editing felt
   * disposable. With no day yet there is no order to preserve, so it generates.
   *
   * It joins `mustVisitIds` either way: that is what keeps it in the day if the
   * traveller later changes the pace or the budget and the day is re-solved.
   */
  function addToPath(placeId: string) {
    if (day.mustVisitIds.includes(placeId)) return;
    const next = [...day.mustVisitIds, placeId];
    patchDay(activeDay, { mustVisitIds: next });

    const current = realIdsOf(day);
    if (day.itinerary && !current.includes(placeId)) {
      recordUndo(activeDay);
      void rebuildDay(activeDay, [...current, placeId]);
      return;
    }
    generateFor(activeDay, { ...buildRequest(day), mustVisitIds: next });
  }

  /**
   * "Start from my saved places" — the second half of the two-step flow.
   *
   * Only the saved places in *this day's* neighbourhood are added. Adding all
   * of them would put a Kadıköy café into a Sultanahmet day, which the engine
   * would then either drop or charge a ferry for; neither is what the button
   * appears to promise.
   *
   * This one regenerates rather than rebuilds, deliberately: it is a statement
   * about what the day should be made of, not an edit to an arrangement.
   */
  async function startFromSaved() {
    const saved = await api.getSavedPlaces().catch(() => [] as Place[]);
    const here = saved.filter((p) => p.hub === day.config.hub).map((p) => p.placeId);
    if (here.length === 0) {
      showToast(t('saved.none'));
      return;
    }
    const next = [...new Set([...day.mustVisitIds, ...here])];
    patchDay(activeDay, { mustVisitIds: next });
    showToast(t('saved.added'));
    await generateFor(activeDay, { ...buildRequest(day), mustVisitIds: next });
  }

  /**
   * Drop a stop the traveller does not want.
   *
   * Rebuild rather than regenerate, for the same reason as adding: the rest of
   * the day is their arrangement. It also leaves `mustVisitIds`, or a stop
   * pinned earlier would be re-added by the very next re-solve and look like
   * the delete had failed.
   */
  function removeStop(placeId: string) {
    const remaining = realIdsOf(day).filter((id) => id !== placeId);
    recordUndo(activeDay);
    patchDay(activeDay, {
      mustVisitIds: day.mustVisitIds.filter((id) => id !== placeId),
      reservations: day.reservations.filter((r) => r.placeId !== placeId),
    });
    if (selectedPlaceId === placeId) setSelectedPlaceId(null);
    void rebuildDay(activeDay, remaining);
  }

  // Tour "Set as Today's Itinerary" → focus this day on the tour's hub.
  function applyTourHub(hub: Hub) {
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

  // Results-first when the user has (or is generating) a route; discovery-first
  // only in the genuine no-route states (error, or offline with no cached plan).
  const showResultsFirst = !!day.itinerary || day.loading;

  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader />

      {isOffline && (
        <div className="bg-terracotta/20 px-4 py-1.5 text-center text-xs font-semibold text-terracotta">
          {!online ? t('dash.offlineReal') : t('dash.offlineBanner')}
        </div>
      )}
      {optimizeBlocked && (
        <div className="flex items-center justify-center gap-2 bg-iznik/20 px-4 py-1.5 text-center text-xs font-semibold text-ink">
          🔒 {usage?.optimizeLimit ?? 3}/{usage?.optimizeLimit ?? 3} — {t('premium.optimizeLeft')}: 0
          <button onClick={() => navigate('/premium')} className="underline">{t('premium.unlock')}</button>
        </div>
      )}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      {/* Day tabs + action bar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-ink/10 px-4 py-2">
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
        {/* Trip length. Free accounts only get Day 1, so offering them more
            days would be offering a row of padlocks. */}
        {isPremium && (
          <label className="flex items-center gap-1.5 text-xs text-ink/60">
            <span>{t('dash.tripLength')}</span>
            <select
              value={days.length}
              onChange={(e) => void setTripLength(Number(e.target.value))}
              className="rounded-lg border border-ink/15 bg-surface-2 px-2 py-1 text-xs font-semibold text-ink outline-none focus:border-iznik"
              aria-label={t('dash.tripLength')}
            >
              {Array.from(
                { length: MAX_TRIP_DAYS - MIN_TRIP_DAYS + 1 },
                (_, i) => MIN_TRIP_DAYS + i,
              ).map((n) => (
                <option key={n} value={n}>
                  {n} {n === 1 ? t('dash.dayOne') : t('dash.dayMany')}
                </option>
              ))}
            </select>
          </label>
        )}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {usage && (
            <span className="rounded-lg border border-ink/10 px-2.5 py-1 text-xs text-ink/60">
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
                ? 'border-sage bg-sage/20 text-sage'
                : 'border-ink/10 text-ink/80 hover:text-ink'
            }`}
          >
            {saveState === 'saved' ? `✓ ${t('dash.saved')}` : saveState === 'saving' ? t('dash.saving') : `💾 ${t('dash.savePlan')}`}
          </button>
          <button
            onClick={() => setShowSplitBill(true)}
            className="rounded-lg border border-ink/10 px-3 py-1.5 text-sm font-semibold text-ink/80 hover:text-ink"
          >
            💰 {t('dash.splitBill')}
          </button>
          {day.itinerary && <ExportRoute itinerary={day.itinerary} />}
          <OfflineDownload days={days.map((d, i) => ({ label: `${t('dash.day')} ${i + 1}`, itinerary: d.itinerary }))} />
          <OfflineToggle offline={isOffline} onToggle={() => setSimulatedOffline((o) => !o)} />
        </div>
      </div>

      {/* Free-text search (between the action bar and the planner) */}
      <div className="px-4 pt-3">
        <SearchBar
          onFocusPlace={setSearchFocus}
          onAddPlace={addToPath}
          onUseTourHub={applyTourHub}
        />
      </div>

      <div
        className={`grid flex-1 grid-cols-1 gap-4 p-4 lg:grid-cols-2 xl:h-[calc(100vh-155px)] ${
          showResultsFirst
            ? 'xl:grid-cols-[minmax(340px,420px)_1fr_320px]' // Today's Path | Map | controls
            : 'xl:grid-cols-[330px_minmax(340px,400px)_1fr]' // controls | Today's Path | Map
        }`}
      >
        {/* Controls / discovery tools. When a route exists they become the
            secondary rail (last); with no route they lead (natural DOM order). */}
        <div className={`space-y-4 overflow-y-auto pr-1 ${showResultsFirst ? 'order-3' : ''}`}>
          <RouteGenerator
            config={day.config}
            onChange={updateConfig}
            onGenerate={handleGenerate}
            generating={day.loading}
            offline={isOffline}
            savedCount={savedIds.size}
            onStartFromSaved={startFromSaved}
          />
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setShowQuiz(true)}
              disabled={isOffline}
              className="rounded-xl border border-iznik/40 px-3 py-2.5 text-sm font-semibold text-ink hover:bg-iznik/10 disabled:opacity-40"
            >
              🎭 {t('dash.vibeQuiz')}
            </button>
            <button
              onClick={openMustVisit}
              className="rounded-xl border border-sage/40 px-3 py-2.5 text-sm font-semibold text-ink hover:bg-sage/10"
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
          <ToursPanel onUseTourHub={applyTourHub} offline={isOffline} />
          <SurvivalWidget />
        </div>

        {/* Today's Path — leads (first) whenever a route exists or is loading. */}
        <div className={`overflow-y-auto pr-1 ${showResultsFirst ? 'order-1' : ''}`}>
          {undoVisible && day.undoStack.length > 0 && (
            <div className="mb-3 flex items-center justify-between gap-2 rounded-xl border border-iznik/40 bg-iznik/10 px-3 py-2 text-sm">
              <span className="text-ink/90">✏️ {t('dash.routeUpdated')}</span>
              <div className="flex items-center gap-2">
                <button onClick={undo} className="rounded-lg bg-iznik px-3 py-1 text-xs font-semibold text-white">
                  ↩ {t('dash.undo')}
                </button>
                <button onClick={() => setUndoVisible(false)} className="text-xs text-ink/50 hover:text-ink">✕</button>
              </div>
            </div>
          )}
          {day.loading && (
            <div className="flex h-40 items-center justify-center text-ink/50">
              <span className="animate-pulse">{t('dash.generating')}</span>
            </div>
          )}
          {day.error && (
            <div className="rounded-xl bg-sunset/15 p-4 text-sm text-terracotta">
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
              visited={visited}
              onToggleVisited={toggleVisited}
              onRemoveStop={removeStop}
              savedIds={savedIds}
              onToggleSaved={toggleSaved}
            />
          )}
        </div>

        {/* Map — sits right after the plan in results-first mode. */}
        <div className={`relative h-[60vh] xl:h-full ${showResultsFirst ? 'order-2' : ''}`}>
          <MapView
            itinerary={day.itinerary}
            selectedPlaceId={selectedPlaceId}
            onSelectPlace={setSelectedPlaceId}
            routeGeometry={routeGeometry}
            focusPlace={searchFocus}
            onAddFocus={(id) => { addToPath(id); setSearchFocus(null); }}
          />
          <SosButton />
        </div>
      </div>
      </DndContext>

      {showQuiz && <TravelVibeQuiz onComplete={handleQuiz} onClose={() => setShowQuiz(false)} />}
      {showMustVisit && (
        <MustVisitList
          selected={day.mustVisitIds}
          onToggle={toggleMustVisit}
          onClose={closeMustVisit}
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

      {/* Bonus flourish, and the least-exercised path in the app — if it throws,
          skip it silently rather than taking the dashboard down with it. */}
      {celebrating && day.itinerary && (
        <ErrorBoundary label="day-celebration" fallback={null}>
          <DayCelebration
            itinerary={day.itinerary}
            badge={unlockedBadge}
            onClose={() => setCelebrating(false)}
            onAddJournal={() => {
              const first = day.itinerary?.stops.find((s) => s.place)?.place;
              setCelebrating(false);
              if (first) setJournalPlace(first);
            }}
          />
        </ErrorBoundary>
      )}

      {/* Transient action feedback (e.g. must-visit picks applied) */}
      {toast && (
        <div
          role="status"
          className="fixed bottom-24 left-1/2 z-[1100] -translate-x-1/2 rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white shadow-soft-lg"
        >
          {toast}
        </div>
      )}

      {/* Floating AI assistant */}
      <AiAssistant
        onAddToPath={addToPath}
        activePlan={
          day.itinerary?.stops
            .map((s) => s.place?.name)
            .filter((n): n is string => Boolean(n)) ?? []
        }
      />
    </div>
  );
}
