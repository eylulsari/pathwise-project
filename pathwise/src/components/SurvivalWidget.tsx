import { useState } from 'react';
import { SURVIVAL_GUIDE } from '../mockData';
import { useT } from '../i18n';

/** City Survival & Etiquette accordion (Transit / Etiquette / Museum / Safety). */
export function SurvivalWidget() {
  const { t } = useT();
  const [open, setOpen] = useState<string | null>('transit');

  return (
    <div className="rounded-2xl border border-ink/10 bg-surface-2 p-4">
      <h3 className="mb-3 font-display text-sm font-bold">{t('survival.title')}</h3>
      <div className="space-y-1.5">
        {SURVIVAL_GUIDE.map((cat) => {
          const isOpen = open === cat.id;
          return (
            <div key={cat.id} className="overflow-hidden rounded-lg border border-ink/10">
              <button
                onClick={() => setOpen(isOpen ? null : cat.id)}
                className="flex w-full items-center justify-between px-3 py-2 text-left text-sm font-semibold text-ink/90 hover:bg-ink/5"
              >
                <span>{cat.icon} {cat.title}</span>
                <span className={`transition-transform ${isOpen ? 'rotate-180' : ''}`}>⌄</span>
              </button>
              {isOpen && (
                <ul className="space-y-1.5 px-3 pb-3 pt-1 text-xs text-ink/70">
                  {cat.tips.map((t, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="text-iznik">›</span>
                      <span>{t}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
