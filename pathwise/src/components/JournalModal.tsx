import { useState } from 'react';
import type { Place } from '../types';
import { api } from '../services/api';
import { useT } from '../i18n';

/** Trip Journal entry editor for a stop: photo (mock URL), note, 1–5 stars. */
export function JournalModal({
  place,
  onSaved,
  onClose,
}: {
  place: Place;
  onSaved?: () => void;
  onClose: () => void;
}) {
  const { t } = useT();
  const [rating, setRating] = useState(5);
  const [note, setNote] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      await api.upsertJournal({
        placeId: place.placeId,
        rating,
        note: note || undefined,
        photoUrl: photoUrl || undefined,
      });
      onSaved?.();
      onClose();
    } catch {
      /* ignore */
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div className="card-cream w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-display text-lg font-bold text-ink">📸 {t('journal.title')}</h3>
            <p className="text-xs text-ink/50">{place.name}</p>
          </div>
          <button onClick={onClose} className="text-ink/40 hover:text-ink">✕</button>
        </div>

        <div className="mt-4 flex justify-center gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              onClick={() => setRating(n)}
              className={`text-3xl ${n <= rating ? 'text-terracotta' : 'text-ink/20'}`}
              aria-label={`${n} stars`}
            >
              ★
            </button>
          ))}
        </div>

        <label className="mt-4 block text-sm font-semibold text-ink/80">{t('journal.photo')}</label>
        <input
          value={photoUrl}
          onChange={(e) => setPhotoUrl(e.target.value)}
          placeholder="https://… (mock upload)"
          className="mt-1 w-full rounded-lg border border-ink/15 px-3 py-2 text-ink outline-none focus:border-iznik"
        />

        <label className="mt-3 block text-sm font-semibold text-ink/80">{t('journal.note')}</label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          placeholder={t('journal.notePlaceholder')}
          className="mt-1 w-full resize-none rounded-lg border border-ink/15 px-3 py-2 text-ink outline-none focus:border-iznik"
        />

        <button onClick={save} disabled={busy} className="btn-accent mt-4 w-full py-2 text-sm">
          {busy ? t('journal.saving') : t('journal.save')}
        </button>
        <p className="mt-2 text-center text-[10px] text-ink/40">{t('journal.mockNote')}</p>
      </div>
    </div>
  );
}
