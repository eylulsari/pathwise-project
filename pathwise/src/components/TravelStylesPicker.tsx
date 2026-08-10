import { useEffect, useState } from 'react';
import type { TravelTag } from '../types';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useT } from '../i18n';

/**
 * Manual travel-style picker.
 *
 * The Vibe Quiz fills these in automatically (and only ever *adds* to them),
 * so this panel exists for the two things the quiz cannot do: state a style
 * without building a route, and — more importantly — remove one. It is the
 * only surface that can take a tag away.
 *
 * The options come from the server rather than a local constant, so the picker
 * can never offer a tag the API would reject.
 */
export function TravelStylesPicker() {
  const { t } = useT();
  const { user, refreshUser } = useAuth();
  const [options, setOptions] = useState<TravelTag[]>([]);
  const [selected, setSelected] = useState<TravelTag[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    api.getTravelStyleOptions().then(setOptions).catch(() => setFailed(true));
    // The auth context only loads the user once, at boot. Taking the Vibe Quiz
    // writes travel styles server-side without touching it, so re-read the
    // user here — otherwise the picker would show a stale set and saving would
    // silently undo what the quiz just added.
    void refreshUser();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Seed from the signed-in user (refreshed just above).
  useEffect(() => {
    setSelected((user?.travelStyles ?? []) as TravelTag[]);
  }, [user?.travelStyles]);

  if (failed || options.length === 0) return null;

  async function toggle(tag: TravelTag) {
    const next = selected.includes(tag)
      ? selected.filter((s) => s !== tag)
      : [...selected, tag];
    // Optimistic: the picker should feel instant, and a failed save is
    // recoverable by tapping again.
    setSelected(next);
    setSaving(true);
    setSaved(false);
    try {
      setSelected(await api.setTravelStyles(next));
      setSaved(true);
    } catch {
      setSelected((user?.travelStyles ?? []) as TravelTag[]); // roll back
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-2xl border border-ink/10 bg-surface-2 p-5">
      <div className="flex items-center gap-2">
        <h2 className="font-display text-lg font-bold text-ink">{t('styles.title')}</h2>
        {saving && <span className="text-xs text-ink/40">{t('styles.saving')}</span>}
        {!saving && saved && <span className="text-xs text-sage">{t('styles.saved')}</span>}
      </div>
      <p className="mt-1 text-xs leading-relaxed text-ink/60">{t('styles.intro')}</p>

      <div className="mt-3 flex flex-wrap gap-2">
        {options.map((tag) => {
          const active = selected.includes(tag);
          return (
            <button
              key={tag}
              onClick={() => void toggle(tag)}
              aria-pressed={active}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                active
                  ? 'border-transparent bg-iznik text-white'
                  : 'border-ink/15 text-ink/60 hover:border-ink/30'
              }`}
            >
              {tag}
            </button>
          );
        })}
      </div>

      {selected.length === 0 && (
        <p className="mt-3 text-xs text-ink/40">{t('styles.emptyHint')}</p>
      )}
    </section>
  );
}
