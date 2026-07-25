import type { Itinerary } from '../types';
import { formatTry } from '../utils/format';
import { useT } from '../i18n';
import { useCurrency } from '../context/CurrencyContext';

/** Live budget tracker — turns coral→fuchsia as you approach/exceed budget. */
export function BudgetBar({ itinerary }: { itinerary: Itinerary }) {
  const { t } = useT();
  const { currency, format } = useCurrency();
  const spent = itinerary.costBreakdown.totalTry;
  const budget = itinerary.budgetTry;
  const pct = Math.min(100, Math.round((spent / budget) * 100));
  const over = itinerary.overBudget;

  const barColor = over
    ? 'bg-fuchsia-neon'
    : pct > 80
      ? 'bg-coral'
      : 'bg-emerald';

  const { ticketsTry, foodTry, transportTry } = itinerary.costBreakdown;

  return (
    <div className="rounded-2xl border border-white/10 bg-night-800 p-4">
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-semibold text-cream/80">{t('today.dailyBudget')}</span>
        <span className={`text-sm font-bold ${over ? 'text-fuchsia' : 'text-cream'}`}>
          {formatTry(spent)} <span className="text-cream/40">/ {formatTry(budget)}</span>
          {currency.code !== 'TRY' && (
            <span className="ml-1 text-cream/40">({format(spent)})</span>
          )}
        </span>
      </div>
      <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-night">
        <div
          className={`h-full rounded-full transition-all duration-500 ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {over && (
        <p className="mt-1.5 text-xs font-medium text-fuchsia">
          ⚠ {t('today.overBudget')} {formatTry(spent - budget)} {t('today.overBudgetTail')}
        </p>
      )}
      <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
        <Split label={`🎟️ ${t('today.tickets')}`} value={ticketsTry} />
        <Split label={`🍽️ ${t('today.food')}`} value={foodTry} />
        <Split label={`🚌 ${t('today.transport')}`} value={transportTry} />
      </div>
    </div>
  );
}

function Split({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-night px-2 py-1.5">
      <div className="text-cream/50">{label}</div>
      <div className="font-semibold text-cream">{formatTry(value)}</div>
    </div>
  );
}
