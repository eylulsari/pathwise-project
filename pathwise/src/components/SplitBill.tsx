import { useState } from 'react';
import { formatTry } from '../utils/format';
import { useCurrency } from '../context/CurrencyContext';
import { CurrencySelect } from './CurrencySelect';

interface LineItem { id: number; label: string; amount: number }

/** Split Bill modal — enter itemized expenses, split by people or by connected
 *  buddies. */
export function SplitBill({ onClose }: { onClose: () => void }) {
  const { currency, format } = useCurrency();
  const [items, setItems] = useState<LineItem[]>([
    { id: 1, label: 'Lunch at Çiya', amount: 420 },
  ]);
  const [label, setLabel] = useState('');
  const [amount, setAmount] = useState('');
  const [people, setPeople] = useState(2);

  const total = items.reduce((s, i) => s + i.amount, 0);
  const perPerson = people > 0 ? total / people : 0;

  function add() {
    const value = Number(amount);
    if (!label.trim() || !value) return;
    setItems((prev) => [...prev, { id: Date.now(), label: label.trim(), amount: value }]);
    setLabel('');
    setAmount('');
  }

  return (
    <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div className="card-cream w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="font-display text-xl font-bold text-night">💰 Split the Bill</h3>
          <div className="flex items-center gap-2">
            <div className="[&_select]:border-night/15 [&_select]:bg-white [&_select]:text-night">
              <CurrencySelect />
            </div>
            <button onClick={onClose} className="text-night/40 hover:text-night">✕</button>
          </div>
        </div>

        <div className="mt-4 space-y-2">
          {items.map((it) => (
            <div key={it.id} className="flex items-center justify-between rounded-lg bg-night/5 px-3 py-2 text-sm text-night">
              <span>{it.label}</span>
              <span className="flex items-center gap-2 font-semibold">
                {formatTry(it.amount)}
                <button onClick={() => setItems((p) => p.filter((x) => x.id !== it.id))} className="text-night/30 hover:text-fuchsia">✕</button>
              </span>
            </div>
          ))}
        </div>

        <div className="mt-3 flex gap-2">
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Item" className="flex-1 rounded-lg border border-night/15 px-3 py-2 text-sm text-night outline-none focus:border-violet" />
          <input value={amount} onChange={(e) => setAmount(e.target.value)} type="number" placeholder="₺" className="w-24 rounded-lg border border-night/15 px-3 py-2 text-sm text-night outline-none focus:border-violet" />
          <button onClick={add} className="rounded-lg bg-violet/20 px-3 text-sm font-semibold text-violet-deep">Add</button>
        </div>

        <div className="mt-4 flex items-center justify-between rounded-xl bg-night/5 px-3 py-2">
          <span className="text-sm font-semibold text-night">Split between</span>
          <div className="flex items-center gap-3">
            <button onClick={() => setPeople((p) => Math.max(1, p - 1))} className="h-7 w-7 rounded-full bg-night/10 font-bold text-night">−</button>
            <span className="w-6 text-center font-bold text-night">{people}</span>
            <button onClick={() => setPeople((p) => p + 1)} className="h-7 w-7 rounded-full bg-night/10 font-bold text-night">+</button>
          </div>
        </div>

        <div className="mt-4 rounded-xl bg-accent-gradient p-4 text-center text-white">
          <p className="text-sm text-white/80">Each person pays</p>
          <p className="font-display text-3xl font-bold">{format(perPerson)}</p>
          {currency.code !== 'TRY' && (
            <p className="text-xs text-white/80">{formatTry(perPerson)}</p>
          )}
          <p className="text-xs text-white/70">Total {format(total)} ÷ {people}</p>
        </div>
      </div>
    </div>
  );
}
