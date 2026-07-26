import { useState } from 'react';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type {
  Itinerary,
  ItineraryStop,
  NearbySuggestion,
  Place,
  StartPoint,
} from '../types';
import { BudgetBar } from './BudgetBar';
import { LocalStoryModal } from './LocalStoryModal';
import { formatTry, formatDuration, formatKm } from '../utils/format';
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
          {reordering && <span className="ml-2 animate-pulse text-iznik">· {t('dash.saving')}</span>}
        </span>
      </div>

      <BudgetBar itinerary={itinerary} />

      {startLeg && (
        <div className="rounded-xl border border-sage/30 bg-sage/10 px-3 py-2 text-xs text-sage">
          <span className="font-semibold">{startPoint!.label}</span> · {startLeg}
        </div>
      )}

      <p className="text-[11px] text-ink/40">{t('today.dragHint')}</p>

      <SortableContext items={realIds} strategy={verticalListSortingStrategy}>
        <ol className="space-y-1">
          {itinerary.stops.map((stop, i) => (
            <StopRow
              key={stop.place ? stop.place.placeId : `lunch-${i}`}
              stop={stop}
              active={stop.place?.placeId === selectedPlaceId}
              onSelect={() => stop.place && onSelectPlace(stop.place.placeId)}
              onStory={() => stop.place && setStoryPlace(stop.place)}
              onReserve={onReserve}
              onJournal={onJournal}
              onToggleAnchor={onToggleAnchor}
            />
          ))}
        </ol>
      </SortableContext>

      {/* "Add this too" nearby suggestion */}
      {suggestion && (
        <div className="rounded-2xl border border-iznik/40 bg-iznik/10 p-3">
          <p className="text-sm">
            <span className="font-semibold text-iznik">{t('suggest.title')}: {suggestion.place.name}</span>
            <span className="text-ink/60"> — {suggestion.walkMinutes} min {t('suggest.away')} ({suggestion.place.rating}★)</span>
          </p>
          <p className="mt-0.5 text-xs italic text-ink/50">💡 {suggestion.place.localTip}</p>
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

function StopRow({
  stop,
  active,
  onSelect,
  onStory,
  onReserve,
  onJournal,
  onToggleAnchor,
}: {
  stop: ItineraryStop;
  active: boolean;
  onSelect: () => void;
  onStory: () => void;
  onReserve?: (place: Place) => void;
  onJournal?: (place: Place) => void;
  onToggleAnchor?: (place: Place, currentArrival: string) => void;
}) {
  const { t } = useT();

  // Lunch break is synthetic → static, not draggable.
  if (stop.isLunchBreak) {
    return (
      <li className="ml-3 border-l-2 border-dashed border-terracotta/50 pl-4">
        <div className="rounded-xl bg-terracotta/10 px-3 py-2 text-sm">
          <span className="font-semibold text-terracotta">🍽️ {t('today.lunch')}</span>
          <span className="ml-2 text-ink/50">
            {stop.arrivalTime}–{stop.departureTime} · {formatTry(stop.foodCostTry)}
          </span>
        </div>
      </li>
    );
  }

  const place = stop.place!;
  return <SortableStopRow stop={stop} place={place} active={active} onSelect={onSelect} onStory={onStory} onReserve={onReserve} onJournal={onJournal} onToggleAnchor={onToggleAnchor} />;
}

function SortableStopRow({
  stop,
  place,
  active,
  onSelect,
  onStory,
  onReserve,
  onJournal,
  onToggleAnchor,
}: {
  stop: ItineraryStop;
  place: Place;
  active: boolean;
  onSelect: () => void;
  onStory: () => void;
  onReserve?: (place: Place) => void;
  onJournal?: (place: Place) => void;
  onToggleAnchor?: (place: Place, currentArrival: string) => void;
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
    <li ref={setNodeRef} style={style} className="ml-3 border-l-2 border-ink/10 pl-4">
      <div
        onClick={onSelect}
        className={`rounded-xl border p-3 transition-colors ${
          active ? 'border-iznik bg-iznik/10' : 'border-ink/10 bg-surface-2 hover:border-ink/20'
        }`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-2">
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
            <div>
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-iznik text-xs font-bold text-white">
                  {stop.order}
                </span>
                <h3 className="font-semibold text-ink">{place.name}</h3>
              </div>
              <p className="mt-1 text-xs text-ink/50">
                🕒 {stop.arrivalTime}–{stop.departureTime} · {formatDuration(stop.durationMinutes)}
                {place.museumPass && <span className="ml-2 text-sage">🎫 {t('today.museumPass')}</span>}
              </p>
              {stop.reservation && (
                <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-terracotta/20 px-2 py-0.5 text-[10px] font-semibold text-terracotta">
                  📎 {stop.reservation.time}
                  {stop.reservation.confirmationCode && ` · ${stop.reservation.confirmationCode}`}
                </span>
              )}
            </div>
          </div>
          <div className="text-right text-xs">
            <div className="text-ink/70">
              🎟️ {stop.entryFeeTry === 0 ? t('today.free') : formatTry(stop.entryFeeTry)}
            </div>
            {stop.foodCostTry > 0 && (
              <div className="text-ink/70">🍽️ {formatTry(stop.foodCostTry)}</div>
            )}
          </div>
        </div>
        <div className="mt-2 flex items-center gap-3">
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
        </div>
      </div>

      {stop.transportToNext && (
        <div className="py-1.5 pl-1 text-xs text-ink/40">{stop.transportToNext.label}</div>
      )}
    </li>
  );
}
