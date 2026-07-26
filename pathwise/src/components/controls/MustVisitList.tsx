import { BUCKET_LIST_IDS } from '../../mockData';
import { PLACES_BY_ID } from '../../hubData';
import { HUB_LABEL, formatTry } from '../../utils/format';
import { useT } from '../../i18n';

/**
 * Must-Visit bucket list. Checked places are ALWAYS forced into the generated
 * route (the backend treats mustVisitIds as never-dropped), even if the budget
 * is strained.
 */
export function MustVisitList({
  selected,
  onToggle,
  onClose,
}: {
  selected: string[];
  onToggle: (id: string) => void;
  onClose: () => void;
}) {
  const { t } = useT();
  return (
    <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div className="card-cream max-h-[85vh] w-full max-w-2xl overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-display text-xl font-bold text-ink">{t('mustVisit.title')}</h3>
            <p className="text-xs text-ink/50">{t('mustVisit.subtitle')}</p>
          </div>
          <button onClick={onClose} className="text-ink/40 hover:text-ink">✕</button>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {BUCKET_LIST_IDS.map((id) => {
            const place = PLACES_BY_ID[id];
            if (!place) return null;
            const on = selected.includes(id);
            return (
              <button
                key={id}
                onClick={() => onToggle(id)}
                className={`flex items-start gap-3 rounded-xl border-2 p-3 text-left transition-colors ${
                  on ? 'border-sage bg-sage/10' : 'border-ink/10 hover:border-ink/25'
                }`}
              >
                <span className={`mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md border-2 text-xs ${on ? 'border-sage bg-sage text-ink' : 'border-ink/30'}`}>
                  {on ? '✓' : ''}
                </span>
                <span>
                  <span className="block font-semibold text-ink">{place.name}</span>
                  <span className="block text-xs text-ink/50">
                    {HUB_LABEL[place.hub]} · {place.entryFeeTry === 0 ? 'Free' : formatTry(place.entryFeeTry)}
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        <button onClick={onClose} className="btn-accent mt-5 w-full">
          {t('mustVisit.done')} {selected.length} {t('mustVisit.lockedIn')}
        </button>
      </div>
    </div>
  );
}
