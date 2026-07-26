import { useCurrency } from '../context/CurrencyContext';

/** Small dropdown to pick the display currency (B4). */
export function CurrencySelect({ className = '' }: { className?: string }) {
  const { currency, setCurrencyCode, currencies } = useCurrency();
  return (
    <select
      value={currency.code}
      onChange={(e) => setCurrencyCode(e.target.value)}
      aria-label="Display currency"
      className={`rounded-lg border border-ink/15 bg-white px-2 py-1 text-xs font-semibold text-ink/80 outline-none focus:border-iznik ${className}`}
    >
      {currencies.map((c) => (
        <option key={c.code} value={c.code}>
          {c.symbol} {c.code}
        </option>
      ))}
    </select>
  );
}
