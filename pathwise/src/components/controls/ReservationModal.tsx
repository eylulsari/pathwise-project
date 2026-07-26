import { useState } from 'react';
import type { Place, Reservation } from '../../types';
import { useT } from '../../i18n';

/** Add/edit a booking pinned to a stop. A pinned time is fixed — the rest of
 *  the day re-times around it. */
export function ReservationModal({
  place,
  existing,
  onSave,
  onRemove,
  onClose,
}: {
  place: Place;
  existing?: Reservation;
  onSave: (r: Reservation) => void;
  onRemove: () => void;
  onClose: () => void;
}) {
  const { t } = useT();
  const [time, setTime] = useState(existing?.time ?? '14:00');
  const [code, setCode] = useState(existing?.confirmationCode ?? '');
  const [note, setNote] = useState(existing?.note ?? '');

  return (
    <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div className="card-cream w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-display text-lg font-bold text-ink">📎 {t('reservation.title')}</h3>
            <p className="text-xs text-ink/50">{place.name}</p>
          </div>
          <button onClick={onClose} className="text-ink/40 hover:text-ink">✕</button>
        </div>

        <label className="mt-4 block text-sm font-semibold text-ink/80">{t('reservation.time')}</label>
        <input
          type="time"
          value={time}
          onChange={(e) => setTime(e.target.value)}
          className="mt-1 w-full rounded-lg border border-ink/15 px-3 py-2 text-ink outline-none focus:border-iznik"
        />

        <label className="mt-3 block text-sm font-semibold text-ink/80">{t('reservation.code')}</label>
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="AYA-9921"
          className="mt-1 w-full rounded-lg border border-ink/15 px-3 py-2 text-ink outline-none focus:border-iznik"
        />

        <label className="mt-3 block text-sm font-semibold text-ink/80">{t('reservation.note')}</label>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={t('reservation.notePlaceholder')}
          className="mt-1 w-full rounded-lg border border-ink/15 px-3 py-2 text-ink outline-none focus:border-iznik"
        />

        <p className="mt-3 text-xs text-ink/50">{t('reservation.pinNote')}</p>

        <div className="mt-5 flex gap-2">
          {existing && (
            <button
              onClick={onRemove}
              className="rounded-lg border-2 border-sunset/40 px-3 py-2 text-sm font-semibold text-terracotta"
            >
              {t('reservation.remove')}
            </button>
          )}
          <button
            onClick={() =>
              onSave({
                placeId: place.placeId,
                time,
                confirmationCode: code || undefined,
                note: note || undefined,
              })
            }
            disabled={!time}
            className="btn-accent flex-1 py-2 text-sm disabled:opacity-40"
          >
            {t('reservation.save')}
          </button>
        </div>
      </div>
    </div>
  );
}
