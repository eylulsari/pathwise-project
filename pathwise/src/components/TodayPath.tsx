import { useState } from 'react';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type {
  Itinerary,
  ItineraryNotice,
  ItineraryStop,
  NearbySuggestion,
  Place,
  StartPoint,
} from '../types';
import { BudgetBar } from './BudgetBar';
import { MuseumPassCard } from './MuseumPassCard';
import { LocalStoryModal } from './LocalStoryModal';
import { OpenNowBadge } from './OpeningHours';
import { SavePlaceButton } from './SavePlaceButton';
import { formatTry, formatDuration, formatKm, formatEntryFee } from '../utils/format';
import { haversineMeters, walkEstimate } from '../utils/geo';
import { useT } from '../i18n';

/** Today's Path — the ordered day plan. Real stops are drag-sortable (the
 *  DndContext lives in Dashboard); an auto lunch break stays static. */
export function TodayPath({
  itinerary,
  selectedPlaceId,
  onSelectPlace,
  startPoint,
  reordering,
  onReserve,
  onJournal,
  onToggleAnchor,
  suggestion,
  onAddSuggestion,
  onDismissSuggestion,
  visited,
  onToggleVisited,
  onRemoveStop,
  savedIds,
  onToggleSaved,
}: {
  itinerary: Itinerary;
  selectedPlaceId: string | null;
  onSelectPlace: (placeId: string) => void;
  startPoint?: StartPoint | null;
  reordering?: boolean;
  onReserve?: (place: Place) => void;
  onJournal?: (place: Place) => void;
  onToggleAnchor?: (place: Place, currentArrival: string) => void;
  suggestion?: NearbySuggestion | null;
  onAddSuggestion?: () => void;
  onDismissSuggestion?: () => void;
  /** Set of placeIds the user has marked visited (for the completion celebration). */
  visited?: Set<string>;
  onToggleVisited?: (placeId: string) => void;
  /** Drop a stop from the day. Absent → the row shows no remove button. */
  onRemoveStop?: (placeId: string) => void;
  /** Bookmarked place ids, so each row can draw its own star without asking. */
  savedIds?: Set<string>;
  onToggleSaved?: (placeId: string) => void;
}) {
  const { t } = useT();
  const [storyPlace, setStoryPlace] = useState<Place | null>(null);

  const realIds = itinerary.stops
    .filter((s) => s.place)
    .map((s) => s.place!.placeId);

  const firstPlace = itinerary.stops.find((s) => s.place)?.place ?? null;
  const startLeg =
    startPoint && firstPlace
      ? walkEstimate(haversineMeters(startPoint, firstPlace))
      : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-xl font-bold">{t('today.title')}</h2>
        <span className="text-xs text-ink/50">
          {formatKm(itinerary.totalDistanceKm)} · {formatDuration(itinerary.totalDurationMinutes)}
          {/* The raw minutes, for tests that need to prove the day was actually
              recomputed rather than merely redrawn. Hidden from sighted users
              and from assistive tech — the formatted value beside it is the
              real label. */}
          <span data-testid="day-total-minutes" hidden aria-hidden="true">
            {itinerary.totalDurationMinutes}
          </span>
          {reordering && <span className="ms-2 animate-pulse text-iznik">· {t('dash.saving')}</span>}
        </span>
      </div>

      <BudgetBar itinerary={itinerary} />

      {/* Sits under the budget because it is about the same money: which of
          today's tickets one pass would cover. Renders nothing on a day with
          no covered stops. */}
      <MuseumPassCard itinerary={itinerary} />

      <RouteNotices notices={itinerary.notices} />

      {startLeg && (
        <div className="rounded-xl border border-sage/30 bg-sage/10 px-3 py-2 text-xs text-sage">
          <span className="font-semibold">{startPoint!.label}</span> · {startLeg}
        </div>
      )}

      <p className="text-[11px] text-ink/40">{t('today.dragHint')}</p>

      <SortableContext items={realIds} strategy={verticalListSortingStrategy}>
        {/* No `space-y` here on purpose: a gap between list items would cut
            the timeline into segments. Each row carries its own bottom
            padding instead, inside the span the spine is drawn across. */}
        <ol>
          {itinerary.stops.map((stop, i) => (
            <StopRow
              key={stop.place ? stop.place.placeId : `lunch-${i}`}
              stop={stop}
              /* Counted over real stops only. `stop.order` includes the lunch
                 break, so once the numbers moved onto the timeline the day
                 read "2, 3, 🍽️, 5, 6" — a skipped number, which looks like a
                 stop went missing rather than like lunch. */
              displayIndex={
                itinerary.stops.slice(0, i + 1).filter((s) => s.place).length
              }
              active={stop.place?.placeId === selectedPlaceId}
              onSelect={() => stop.place && onSelectPlace(stop.place.placeId)}
              onStory={() => stop.place && setStoryPlace(stop.place)}
              onReserve={onReserve}
              onJournal={onJournal}
              onToggleAnchor={onToggleAnchor}
              visited={stop.place ? visited?.has(stop.place.placeId) : false}
              onToggleVisited={onToggleVisited}
              onRemove={onRemoveStop}
              isSaved={stop.place ? savedIds?.has(stop.place.placeId) : false}
              onToggleSaved={onToggleSaved}
            />
          ))}
        </ol>
      </SortableContext>

      {/* "Add this too" nearby suggestion */}
      {suggestion && (
        <div className="rounded-2xl border border-iznik/40 bg-iznik/10 p-3">
          <p className="text-sm">
            <span className="font-semibold text-iznik">{t('suggest.title')}: {suggestion.place.name}</span>
            <span className="text-ink/60">
              {' '}— {suggestion.walkMinutes} min {t('suggest.away')}
              {suggestion.place.rating !== null && ` (${suggestion.place.rating}★)`}
            </span>
          </p>
          {suggestion.place.localTip?.trim() && (
            <p className="mt-0.5 text-xs italic text-ink/50">💡 {suggestion.place.localTip}</p>
          )}
          <div className="mt-2 flex gap-2">
            <button onClick={onAddSuggestion} className="rounded-lg bg-iznik px-3 py-1.5 text-xs font-semibold text-white">
              {t('suggest.add')}
            </button>
            <button onClick={onDismissSuggestion} className="rounded-lg border border-ink/15 px-3 py-1.5 text-xs font-semibold text-ink/60">
              {t('suggest.dismiss')}
            </button>
          </div>
        </div>
      )}

      {storyPlace && (
        <LocalStoryModal place={storyPlace} onClose={() => setStoryPlace(null)} />
      )}
    </div>
  );
}

/**
 * Notices about the day as a whole — a stop the engine could not honour, or a
 * ferry the plan depends on.
 *
 * These are placed above the stop list rather than beside a single stop
 * because they describe the shape of the whole day. A dropped must-visit in
 * particular has no row to attach to: the whole point is that it is not there,
 * and a stop that vanishes with no explanation reads as a bug.
 */
const NOTICE_KEY: Record<ItineraryNotice['code'], string> = {
  'adalar-separate-day': 'today.noticeAdalarSeparateDay',
  'adalar-return-ferry': 'today.noticeAdalarReturnFerry',
  'adalar-last-ferry': 'today.noticeAdalarLastFerry',
  'cross-side-day': 'today.noticeCrossSideDay',
  'closed-that-day': 'today.noticeClosedThatDay',
  'opens-too-late': 'today.noticeOpensTooLate',
};

function RouteNotices({ notices }: { notices?: ItineraryNotice[] }) {
  const { t } = useT();
  if (!notices || notices.length === 0) return null;

  return (
    <div className="space-y-1.5">
      {notices.map((notice) => (
        <div
          key={notice.code}
          role={notice.severity === 'warning' ? 'alert' : undefined}
          className={`rounded-xl border px-3 py-2 text-xs ${
            notice.severity === 'warning'
              ? 'border-terracotta/40 bg-terracotta/10 text-terracotta'
              : 'border-ink/10 bg-ink/5 text-ink/60'
          }`}
        >
          {notice.severity === 'warning' ? '⚠️ ' : '🚢 '}
          {t(NOTICE_KEY[notice.code]).replace(
            '{places}',
            (notice.places ?? []).join(', '),
          )}
        </div>
      ))}
    </div>
  );
}

function StopRow({
  stop,
  displayIndex,
  active,
  onSelect,
  onStory,
  onReserve,
  onJournal,
  onToggleAnchor,
  visited,
  onToggleVisited,
  onRemove,
  isSaved,
  onToggleSaved,
}: {
  stop: ItineraryStop;
  /** Position among real stops — the lunch break does not take a number. */
  displayIndex: number;
  active: boolean;
  onSelect: () => void;
  onStory: () => void;
  onReserve?: (place: Place) => void;
  onJournal?: (place: Place) => void;
  onToggleAnchor?: (place: Place, currentArrival: string) => void;
  visited?: boolean;
  onToggleVisited?: (placeId: string) => void;
  onRemove?: (placeId: string) => void;
  isSaved?: boolean;
  onToggleSaved?: (placeId: string) => void;
}) {
  const { t } = useT();

  // Lunch break is synthetic → static, not draggable. It sits on the same
  // spine as the real stops but with a hollow marker, so the eye reads it as
  // part of the day without mistaking it for somewhere you have to go.
  if (stop.isLunchBreak) {
    return (
      <li className="relative pb-2 ps-9">
        <Spine />
        <span className="absolute start-0 top-2.5 flex h-6 w-6 items-center justify-center rounded-full border-2 border-dashed border-terracotta/60 bg-surface text-[11px]">
          🍽️
        </span>
        <div className="rounded-xl border border-terracotta/25 bg-terracotta/10 px-3 py-2 text-sm">
          <span className="font-semibold text-terracotta">{t('today.lunch')}</span>
          <span className="ms-2 text-ink/50">
            {stop.arrivalTime}–{stop.departureTime} · {formatTry(stop.foodCostTry)}
          </span>
        </div>
      </li>
    );
  }

  const place = stop.place!;
  return <SortableStopRow stop={stop} displayIndex={displayIndex} place={place} active={active} onSelect={onSelect} onStory={onStory} onReserve={onReserve} onJournal={onJournal} onToggleAnchor={onToggleAnchor} visited={visited} onToggleVisited={onToggleVisited} onRemove={onRemove} isSaved={isSaved} onToggleSaved={onToggleSaved} />;
}

function SortableStopRow({
  stop,
  displayIndex,
  place,
  active,
  onSelect,
  onStory,
  onReserve,
  onJournal,
  onToggleAnchor,
  visited,
  onToggleVisited,
  onRemove,
  isSaved,
  onToggleSaved,
}: {
  stop: ItineraryStop;
  displayIndex: number;
  place: Place;
  active: boolean;
  onSelect: () => void;
  onStory: () => void;
  onReserve?: (place: Place) => void;
  onJournal?: (place: Place) => void;
  onToggleAnchor?: (place: Place, currentArrival: string) => void;
  visited?: boolean;
  onToggleVisited?: (placeId: string) => void;
  onRemove?: (placeId: string) => void;
  isSaved?: boolean;
  onToggleSaved?: (placeId: string) => void;
}) {
  const { t } = useT();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: place.placeId });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <li ref={setNodeRef} style={style} className="relative pb-2 ps-9">
      <Spine />
      {/* The stop's place in the day, on the line rather than inside the card.
          It used to sit next to the title, which made every row start with a
          number and pushed the name — the thing being looked for — inward. */}
      <span
        className={`absolute start-0 top-2.5 flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold shadow-soft transition-colors ${
          visited
            ? 'bg-sage text-ink'
            : active
              ? 'bg-iznik text-white ring-2 ring-iznik/30'
              : 'bg-iznik text-white'
        }`}
      >
        {visited ? '✓' : displayIndex}
      </span>
      <div
        onClick={onSelect}
        className={`rounded-xl border p-3 transition-all ${
          active
            ? 'border-iznik bg-iznik/10 shadow-soft'
            : 'border-ink/10 bg-surface-2 hover:border-ink/20 hover:shadow-soft'
        } ${visited ? 'opacity-70' : ''}`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-2">
            {/* Visited toggle — completing all stops triggers the celebration */}
            {onToggleVisited && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleVisited(place.placeId);
                }}
                aria-label={t('today.markVisited')}
                title={visited ? t('today.visited') : t('today.markVisited')}
                className={`mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border-2 text-[11px] font-bold transition-colors ${
                  visited ? 'border-sage bg-sage text-ink' : 'border-ink/25 text-transparent hover:border-sage'
                }`}
              >
                ✓
              </button>
            )}
            {/* Drag handle */}
            <button
              {...attributes}
              {...listeners}
              onClick={(e) => e.stopPropagation()}
              className="mt-0.5 cursor-grab touch-none text-ink/30 hover:text-ink/70 active:cursor-grabbing"
              title={t('today.dragHandle')}
              aria-label={t('today.dragHandle')}
            >
              ⠿
            </button>
            <div className="min-w-0">
              <h3 className={`font-semibold leading-snug text-ink ${visited ? 'line-through decoration-sage decoration-2' : ''}`}>
                {place.name}
              </h3>
              <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-ink/50">
                {/* Arrival is what a traveller scans for, so it is the one
                    number here set in a face that keeps its columns. */}
                <span className="font-semibold tabular-nums text-ink/70">{stop.arrivalTime}</span>
                <span className="text-ink/30">→</span>
                <span className="tabular-nums">{stop.departureTime}</span>
                <span className="text-ink/30">·</span>
                <span>{formatDuration(stop.durationMinutes)}</span>
                {place.museumPass && (
                  <span className="rounded-full bg-sage/20 px-1.5 py-px text-[10px] font-semibold text-sage">
                    🎫 {t('today.museumPass')}
                  </span>
                )}
              </p>
              {/* Whether the door is actually open right now, in Istanbul time.
                  Renders nothing at all when the hours are unknown. */}
              <OpenNowBadge place={place} className="mt-0.5 block text-[11px]" />
              {stop.reservation && (
                <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-terracotta/20 px-2 py-0.5 text-[10px] font-semibold text-terracotta">
                  📎 {stop.reservation.time}
                  {stop.reservation.confirmationCode && ` · ${stop.reservation.confirmationCode}`}
                </span>
              )}
            </div>
          </div>
          <div className="text-end text-xs">
            <div className="text-ink/70">
              🎟️ {formatEntryFee(stop.entryFeeTry, stop.place?.entryFeeApprox, t('today.free'))}
            </div>
            {stop.foodCostTry > 0 && (
              <div className="text-ink/70">🍽️ {formatTry(stop.foodCostTry)}</div>
            )}
          </div>
        </div>
        {/* `flex-wrap`, and every label kept on one line.
            Without it the row could not wrap, so the buttons shrank instead
            and each label broke inside itself — "Read Local / Story & Tips",
            "Lock / time" — which at the real column width made a tidy row of
            six actions look like a rendering fault. */}
        <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-ink/5 pt-2 [&>button]:whitespace-nowrap">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onStory();
            }}
            className="text-xs font-semibold text-iznik hover:text-terracotta"
          >
            {t('today.readStory')}
          </button>
          {onReserve && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onReserve(place);
              }}
              className="text-xs font-semibold text-terracotta hover:text-terracotta"
            >
              {stop.reservation ? '📎 ' + stop.reservation.time : t('reservation.add')}
            </button>
          )}
          {onJournal && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onJournal(place);
              }}
              className="text-xs font-semibold text-sage hover:text-terracotta"
            >
              {t('journal.button')}
            </button>
          )}
          {onToggleAnchor && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleAnchor(place, stop.arrivalTime);
              }}
              className={`text-xs font-semibold hover:text-terracotta ${stop.reservation ? 'text-terracotta' : 'text-ink/50'}`}
              title={t('anchor.lockTip')}
            >
              {stop.reservation ? `⚓ ${t('anchor.locked')}` : `⏰ ${t('anchor.lock')}`}
            </button>
          )}
          {onToggleSaved && (
            <SavePlaceButton
              placeId={place.placeId}
              placeName={place.name}
              saved={Boolean(isSaved)}
              onToggle={onToggleSaved}
            />
          )}
          {onRemove && (
            // Pushed to the right so "remove" is never the button next to the
            // one you meant to press.
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRemove(place.placeId);
              }}
              className="ms-auto text-xs font-semibold text-ink/40 hover:text-terracotta"
              title={t('today.removeStopTip')}
              aria-label={`${t('today.removeStop')}: ${place.name}`}
            >
              ✕ {t('today.removeStop')}
            </button>
          )}
        </div>
      </div>

      {stop.transportToNext && (
        // The hop to the next stop is part of the day, not a caption under the
        // card: at 40% opacity in the old layout it read as disabled text, and
        // the ferry legs that cost an hour were the easiest thing to miss.
        <div className="relative py-2">
          <span
            aria-hidden="true"
            className="absolute start-[11px] top-0 flex h-full w-0.5 items-center justify-center bg-transparent"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-ink/20" />
          </span>
          <p className="text-xs font-medium text-ink/45">{stop.transportToNext.label}</p>
        </div>
      )}
    </li>
  );
}

/**
 * The vertical line the day hangs from.
 *
 * One element, absolutely placed, drawn behind each row's marker — so the
 * timeline is continuous down the list instead of being a left border that
 * restarts and leaves a gap at every card.
 */
function Spine() {
  return (
    <span
      aria-hidden="true"
      className="absolute start-[11px] top-0 h-full w-0.5 bg-ink/10"
    />
  );
}
