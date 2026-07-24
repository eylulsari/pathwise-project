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
        <span className="text-xs text-cream/50">
          {formatKm(itinerary.totalDistanceKm)} · {formatDuration(itinerary.totalDurationMinutes)}
          {reordering && <span className="ml-2 animate-pulse text-violet">· {t('dash.saving')}</span>}
        </span>
      </div>

      <BudgetBar itinerary={itinerary} />

      {startLeg && (
        <div className="rounded-xl border border-emerald/30 bg-emerald/10 px-3 py-2 text-xs text-emerald">
          <span className="font-semibold">{startPoint!.label}</span> · {startLeg}
        </div>
      )}

      <p className="text-[11px] text-cream/40">{t('today.dragHint')}</p>

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
            />
          ))}
        </ol>
      </SortableContext>

      {/* "Add this too" nearby suggestion */}
      {suggestion && (
        <div className="rounded-2xl border border-violet/40 bg-violet/10 p-3">
          <p className="text-sm">
            <span className="font-semibold text-violet">{t('suggest.title')}: {suggestion.place.name}</span>
            <span className="text-cream/60"> — {suggestion.walkMinutes} min {t('suggest.away')} ({suggestion.place.rating}★)</span>
          </p>
          <p className="mt-0.5 text-xs italic text-cream/50">💡 {suggestion.place.localTip}</p>
          <div className="mt-2 flex gap-2">
            <button onClick={onAddSuggestion} className="rounded-lg bg-accent-gradient px-3 py-1.5 text-xs font-semibold text-white">
              {t('suggest.add')}
            </button>
            <button onClick={onDismissSuggestion} className="rounded-lg border border-white/15 px-3 py-1.5 text-xs font-semibold text-cream/60">
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
}: {
  stop: ItineraryStop;
  active: boolean;
  onSelect: () => void;
  onStory: () => void;
  onReserve?: (place: Place) => void;
}) {
  const { t } = useT();

  // Lunch break is synthetic → static, not draggable.
  if (stop.isLunchBreak) {
    return (
      <li className="ml-3 border-l-2 border-dashed border-coral/50 pl-4">
        <div className="rounded-xl bg-coral/10 px-3 py-2 text-sm">
          <span className="font-semibold text-coral">🍽️ {t('today.lunch')}</span>
          <span className="ml-2 text-cream/50">
            {stop.arrivalTime}–{stop.departureTime} · {formatTry(stop.foodCostTry)}
          </span>
        </div>
      </li>
    );
  }

  const place = stop.place!;
  return <SortableStopRow stop={stop} place={place} active={active} onSelect={onSelect} onStory={onStory} onReserve={onReserve} />;
}

function SortableStopRow({
  stop,
  place,
  active,
  onSelect,
  onStory,
  onReserve,
}: {
  stop: ItineraryStop;
  place: Place;
  active: boolean;
  onSelect: () => void;
  onStory: () => void;
  onReserve?: (place: Place) => void;
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
    <li ref={setNodeRef} style={style} className="ml-3 border-l-2 border-white/10 pl-4">
      <div
        onClick={onSelect}
        className={`rounded-xl border p-3 transition-colors ${
          active ? 'border-violet bg-violet/10' : 'border-white/10 bg-night-800 hover:border-white/20'
        }`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-2">
            {/* Drag handle */}
            <button
              {...attributes}
              {...listeners}
              onClick={(e) => e.stopPropagation()}
              className="mt-0.5 cursor-grab touch-none text-cream/30 hover:text-cream/70 active:cursor-grabbing"
              title={t('today.dragHandle')}
              aria-label={t('today.dragHandle')}
            >
              ⠿
            </button>
            <div>
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent-gradient text-xs font-bold text-white">
                  {stop.order}
                </span>
                <h3 className="font-semibold text-cream">{place.name}</h3>
              </div>
              <p className="mt-1 text-xs text-cream/50">
                🕒 {stop.arrivalTime}–{stop.departureTime} · {formatDuration(stop.durationMinutes)}
                {place.museumPass && <span className="ml-2 text-emerald">🎫 {t('today.museumPass')}</span>}
              </p>
              {stop.reservation && (
                <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-coral/20 px-2 py-0.5 text-[10px] font-semibold text-coral">
                  📎 {stop.reservation.time}
                  {stop.reservation.confirmationCode && ` · ${stop.reservation.confirmationCode}`}
                </span>
              )}
            </div>
          </div>
          <div className="text-right text-xs">
            <div className="text-cream/70">
              🎟️ {stop.entryFeeTry === 0 ? t('today.free') : formatTry(stop.entryFeeTry)}
            </div>
            {stop.foodCostTry > 0 && (
              <div className="text-cream/70">🍽️ {formatTry(stop.foodCostTry)}</div>
            )}
          </div>
        </div>
        <div className="mt-2 flex items-center gap-3">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onStory();
            }}
            className="text-xs font-semibold text-violet hover:text-fuchsia"
          >
            {t('today.readStory')}
          </button>
          {onReserve && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onReserve(place);
              }}
              className="text-xs font-semibold text-coral hover:text-fuchsia"
            >
              {stop.reservation ? '📎 ' + stop.reservation.time : t('reservation.add')}
            </button>
          )}
        </div>
      </div>

      {stop.transportToNext && (
        <div className="py-1.5 pl-1 text-xs text-cream/40">{stop.transportToNext.label}</div>
      )}
    </li>
  );
}
