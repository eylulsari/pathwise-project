import { useState } from 'react';
import type { Itinerary, ItineraryStop, Place, StartPoint } from '../types';
import { BudgetBar } from './BudgetBar';
import { LocalStoryModal } from './LocalStoryModal';
import { formatTry, formatDuration, formatKm } from '../utils/format';
import { haversineMeters, walkEstimate } from '../utils/geo';

/** Today's Path — the ordered day plan with times, costs, transport legs, an
 *  auto lunch break and a local-story button per real stop. */
export function TodayPath({
  itinerary,
  selectedPlaceId,
  onSelectPlace,
  startPoint,
}: {
  itinerary: Itinerary;
  selectedPlaceId: string | null;
  onSelectPlace: (placeId: string) => void;
  startPoint?: StartPoint | null;
}) {
  const [storyPlace, setStoryPlace] = useState<Place | null>(null);

  const firstPlace = itinerary.stops.find((s) => s.place)?.place ?? null;
  const startLeg =
    startPoint && firstPlace
      ? walkEstimate(haversineMeters(startPoint, firstPlace))
      : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-xl font-bold">Today’s Path</h2>
        <span className="text-xs text-cream/50">
          {formatKm(itinerary.totalDistanceKm)} · {formatDuration(itinerary.totalDurationMinutes)}
        </span>
      </div>

      <BudgetBar itinerary={itinerary} />

      {startLeg && (
        <div className="rounded-xl border border-emerald/30 bg-emerald/10 px-3 py-2 text-xs text-emerald">
          <span className="font-semibold">{startPoint!.label}</span> · {startLeg}
        </div>
      )}

      <ol className="space-y-1">
        {itinerary.stops.map((stop, i) => (
          <StopRow
            key={i}
            stop={stop}
            active={stop.place?.placeId === selectedPlaceId}
            onSelect={() => stop.place && onSelectPlace(stop.place.placeId)}
            onStory={() => stop.place && setStoryPlace(stop.place)}
          />
        ))}
      </ol>

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
}: {
  stop: ItineraryStop;
  active: boolean;
  onSelect: () => void;
  onStory: () => void;
}) {
  if (stop.isLunchBreak) {
    return (
      <li className="ml-3 border-l-2 border-dashed border-coral/50 pl-4">
        <div className="rounded-xl bg-coral/10 px-3 py-2 text-sm">
          <span className="font-semibold text-coral">🍽️ Lunch Break</span>
          <span className="ml-2 text-cream/50">
            {stop.arrivalTime}–{stop.departureTime} · {formatTry(stop.foodCostTry)}
          </span>
        </div>
      </li>
    );
  }

  const place = stop.place!;
  return (
    <li className="ml-3 border-l-2 border-white/10 pl-4">
      <div
        onClick={onSelect}
        className={`cursor-pointer rounded-xl border p-3 transition-colors ${
          active
            ? 'border-violet bg-violet/10'
            : 'border-white/10 bg-night-800 hover:border-white/20'
        }`}
      >
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent-gradient text-xs font-bold text-white">
                {stop.order}
              </span>
              <h3 className="font-semibold text-cream">{place.name}</h3>
            </div>
            <p className="mt-1 text-xs text-cream/50">
              🕒 {stop.arrivalTime}–{stop.departureTime} · {formatDuration(stop.durationMinutes)}
              {place.museumPass && <span className="ml-2 text-emerald">🎫 Museum Pass</span>}
            </p>
          </div>
          <div className="text-right text-xs">
            <div className="text-cream/70">
              🎟️ {stop.entryFeeTry === 0 ? 'Free' : formatTry(stop.entryFeeTry)}
            </div>
            {stop.foodCostTry > 0 && (
              <div className="text-cream/70">🍽️ {formatTry(stop.foodCostTry)}</div>
            )}
          </div>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onStory();
          }}
          className="mt-2 text-xs font-semibold text-violet hover:text-fuchsia"
        >
          📖 Read Local Story & Tips
        </button>
      </div>

      {/* Transport leg to next stop */}
      {stop.transportToNext && (
        <div className="py-1.5 pl-1 text-xs text-cream/40">{stop.transportToNext.label}</div>
      )}
    </li>
  );
}
