import { useCallback, useMemo, useState } from 'react';
import type {
  ExpenseCategory,
  ExpenseCurrency,
  ExpenseLedger,
  ItineraryStop,
  MessagingConnection,
  Place,
} from '../types';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useCurrency } from '../context/CurrencyContext';
import { useAsyncList } from '../hooks/useAsyncList';
import { ListState } from './ListState';
import { CurrencySelect } from './CurrencySelect';
import { useT } from '../i18n';
import { formatTry } from '../utils/format';

const CATEGORIES: ExpenseCategory[] = [
  'food',
  'tickets',
  'transport',
  'shopping',
  'other',
];
const CURRENCIES: ExpenseCurrency[] = ['TRY', 'USD', 'EUR', 'GBP'];

const EMPTY_LEDGER: ExpenseLedger = {
  expenses: [],
  spentByDayTry: {},
  totalTry: 0,
  byCategoryTry: {},
  debts: [],
  names: {},
  settlementIsRecordOnly: true,
};

/**
 * What the trip actually cost, against what it was planned to cost, and who
 * owes whom at the end of it.
 *
 * NOT A PAYMENT SCREEN, AND SAYS SO
 * There is no "pay" button here and there is not going to be one. Pathwise
 * counts; the group settles up the way they already do. That is the same
 * decision the tours page makes by linking out to the operator instead of
 * selling the ticket: taking money would bring licensing, refunds and
 * chargebacks into a trip planner, and the traveller gains nothing they do not
 * already have. The banner states it rather than leaving it to be inferred
 * from the absence of a button.
 *
 * WHOSE RECORD IT IS
 * Yours. Naming a buddy does not notify them, bind them, or write anything
 * into their own ledger — the settlement is a list you can act on, not a claim
 * against an account. The note under it says that too, because a screen that
 * prints "Bora owes you ₺960" invites the opposite assumption.
 *
 * This replaced a Split Bill modal that kept its items in component state,
 * opened pre-loaded with an invented ₺420 lunch, and split by a headcount with
 * no notion of who paid. It could not survive a reload, and the one number it
 * showed was an equal share of a bill nobody had entered.
 */
export function ExpenseTracker({
  onClose,
  dayCount,
  activeDay,
  budgetsTry,
  stops,
}: {
  onClose: () => void;
  dayCount: number;
  activeDay: number;
  /** Planned budget per day index, from the plan the traveller configured. */
  budgetsTry: number[];
  /** Today's stops, so an expense can be pinned to where it happened. */
  stops: ItineraryStop[];
}) {
  const { t } = useT();
  const { user } = useAuth();
  const { currency, format } = useCurrency();

  const load = useCallback(async () => [await api.getExpenses()], []);
  const { items, status, reload } = useAsyncList<ExpenseLedger>(load, []);
  const ledger = items[0] ?? EMPTY_LEDGER;

  const loadBuddies = useCallback(async () => {
    const all = await api.listConnections();
    return all.filter((c) => c.status === 'accepted');
  }, []);
  const { items: buddies } = useAsyncList<MessagingConnection>(loadBuddies, []);

  const [dayIndex, setDayIndex] = useState(activeDay);
  const [category, setCategory] = useState<ExpenseCategory>('food');
  const [amount, setAmount] = useState('');
  const [entryCurrency, setEntryCurrency] = useState<ExpenseCurrency>('TRY');
  const [placeId, setPlaceId] = useState('');
  const [note, setNote] = useState('');
  const [paidBy, setPaidBy] = useState('');
  const [sharedWith, setSharedWith] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);

  const me = user?.id ?? '';
  const nameOf = (id: string): string =>
    id === me ? t('expenses.you') : (ledger.names[id] ?? buddyName(buddies, id));

  const spentToday = ledger.spentByDayTry[dayIndex] ?? 0;
  const plannedToday = budgetsTry[dayIndex] ?? 0;

  /**
   * The real stops, in the order they are visited.
   *
   * A stop's place is nullable — a lunch break is a stop with no place — so
   * the list is narrowed once here rather than guarded at each use.
   */
  const placedStops = useMemo(
    () => stops.filter((s): s is typeof s & { place: Place } => s.place !== null),
    [stops],
  );

  const chosenStop = useMemo(
    () => placedStops.find((s) => s.place.placeId === placeId),
    [placedStops, placeId],
  );

  async function submit(): Promise<void> {
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) return;

    setSaving(true);
    setFailed(false);
    try {
      await api.addExpense({
        dayIndex,
        category,
        amount: Math.round(value * 100) / 100,
        currency: entryCurrency,
        ...(placeId ? { placeId, placeName: chosenStop?.place.name ?? placeId } : {}),
        ...(note.trim() ? { note: note.trim() } : {}),
        ...(paidBy ? { paidByUserId: paidBy } : {}),
        // A shared expense includes the payer: they ate the meal too. An empty
        // list stays empty — that is the "personal expense" case, and adding
        // the owner to it would create a debt from them to themselves.
        ...(sharedWith.length
          ? { participantIds: [...new Set([paidBy || me, ...sharedWith])] }
          : {}),
      });
      setAmount('');
      setNote('');
      setPlaceId('');
      setSharedWith([]);
      await reload();
    } catch {
      setFailed(true);
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string): Promise<void> {
    try {
      await api.deleteExpense(id);
      await reload();
    } catch {
      setFailed(true);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        className="card-cream max-h-[88vh] w-full max-w-lg overflow-y-auto p-6"
        data-testid="expense-tracker"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="font-display text-xl font-bold text-ink">
            💰 {t('expenses.title')}
          </h3>
          <div className="flex items-center gap-2">
            <div className="[&_select]:border-ink/15 [&_select]:bg-white [&_select]:text-ink">
              <CurrencySelect />
            </div>
            <button onClick={onClose} className="text-ink/40 hover:text-ink">
              ✕
            </button>
          </div>
        </div>

        {/* Stated, not implied by the absence of a pay button. */}
        <p
          className="mt-2 rounded-lg bg-ink/5 px-3 py-2 text-xs text-ink/70"
          data-testid="expense-record-only"
        >
          🔒 {t('expenses.recordOnly')}
        </p>

        {/* ── Record ─────────────────────────────────────────────── */}
        <section className="mt-4 space-y-2">
          <div className="flex gap-2">
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              type="number"
              min="0"
              step="0.01"
              placeholder={t('expenses.amount')}
              aria-label={t('expenses.amount')}
              className="w-28 rounded-lg border border-ink/15 px-3 py-2 text-sm text-ink outline-none focus:border-iznik"
            />
            <select
              value={entryCurrency}
              onChange={(e) => setEntryCurrency(e.target.value as ExpenseCurrency)}
              aria-label="Currency"
              data-testid="expense-currency"
              className="rounded-lg border border-ink/15 bg-white px-2 py-2 text-sm text-ink outline-none focus:border-iznik"
            >
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
              aria-label={t('expenses.category')}
              data-testid="expense-category"
              className="flex-1 rounded-lg border border-ink/15 bg-white px-2 py-2 text-sm text-ink outline-none focus:border-iznik"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {t(`expenses.cat.${c}`)}
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-2">
            <select
              value={dayIndex}
              onChange={(e) => setDayIndex(Number(e.target.value))}
              aria-label={t('expenses.day', { day: String(dayIndex + 1) })}
              data-testid="expense-day"
              className="rounded-lg border border-ink/15 bg-white px-2 py-2 text-sm text-ink outline-none focus:border-iznik"
            >
              {Array.from({ length: dayCount }, (_, i) => (
                <option key={i} value={i}>
                  {t('expenses.day', { day: String(i + 1) })}
                </option>
              ))}
            </select>
            <select
              value={placeId}
              onChange={(e) => setPlaceId(e.target.value)}
              aria-label={t('expenses.place')}
              data-testid="expense-place"
              className="min-w-0 flex-1 rounded-lg border border-ink/15 bg-white px-2 py-2 text-sm text-ink outline-none focus:border-iznik"
            >
              <option value="">{t('expenses.place')}</option>
              {placedStops.map((s) => (
                <option key={s.place.placeId} value={s.place.placeId}>
                  {s.place.name}
                </option>
              ))}
            </select>
          </div>

          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t('expenses.note')}
            aria-label={t('expenses.note')}
            className="w-full rounded-lg border border-ink/15 px-3 py-2 text-sm text-ink outline-none focus:border-iznik"
          />

          {/* Splitting is only offered with people who accepted a connection —
              the server refuses anyone else, and offering names it would
              reject would be a form that lies about what it can do. */}
          {buddies.length === 0 ? (
            <p className="text-xs text-ink/50">{t('expenses.buddiesEmpty')}</p>
          ) : (
            <div className="space-y-1.5 rounded-lg bg-ink/5 p-2.5">
              <label className="block text-xs font-semibold text-ink/70">
                {t('expenses.paidBy')}
              </label>
              <select
                value={paidBy}
                onChange={(e) => setPaidBy(e.target.value)}
                data-testid="expense-paid-by"
                aria-label={t('expenses.paidBy')}
                className="w-full rounded-lg border border-ink/15 bg-white px-2 py-1.5 text-sm text-ink outline-none focus:border-iznik"
              >
                <option value="">{t('expenses.you')}</option>
                {buddies.map((b) => (
                  <option key={b.userId} value={b.userId}>
                    {b.name}
                  </option>
                ))}
              </select>

              <span className="block pt-1 text-xs font-semibold text-ink/70">
                {t('expenses.sharedWith')}
              </span>
              <div className="flex flex-wrap gap-1.5">
                {buddies.map((b) => {
                  const on = sharedWith.includes(b.userId);
                  return (
                    <button
                      key={b.userId}
                      onClick={() =>
                        setSharedWith((prev) =>
                          on ? prev.filter((x) => x !== b.userId) : [...prev, b.userId],
                        )
                      }
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                        on ? 'bg-iznik text-white' : 'bg-white text-ink/70'
                      }`}
                    >
                      {b.name}
                    </button>
                  );
                })}
              </div>
              {sharedWith.length === 0 && (
                <p className="text-[11px] text-ink/50">{t('expenses.justMe')}</p>
              )}
            </div>
          )}

          <button
            onClick={submit}
            disabled={saving || !amount}
            data-testid="expense-add"
            className="btn-accent w-full px-4 py-2 text-sm disabled:opacity-50"
          >
            {t('expenses.add')}
          </button>
          {failed && (
            <p className="text-xs font-semibold text-terracotta">
              {t('expenses.failed')}
            </p>
          )}
        </section>

        {/* A ledger that failed to load must not be drawn as an empty one.
            "₺2000 left" and "Nobody owes anybody" are both true statements
            about a trip with no expenses and both false about a trip whose
            expenses could not be fetched — and on screen they are identical.
            So when the read fails, the whole readout is replaced by the
            failure rather than rendered from zeros. */}
        {status === 'error' ? (
          <p
            data-testid="expense-load-error"
            className="mt-4 rounded-xl bg-terracotta/10 px-3 py-3 text-sm font-semibold text-terracotta"
          >
            {t('expenses.loadFailed')}
          </p>
        ) : (
          <>
        {/* ── Against the plan ───────────────────────────────────── */}
        <section
          className="mt-4 rounded-xl bg-iznik/10 p-3"
          data-testid="expense-budget"
        >
          <h4 className="text-sm font-bold text-iznik">
            {t('expenses.budgetTitle')} · {t('expenses.day', { day: String(dayIndex + 1) })}
          </h4>
          <p className="mt-1 text-sm text-ink/80">
            {spentToday > plannedToday
              ? t('expenses.budgetOver', {
                  amount: format(spentToday - plannedToday),
                  budget: format(plannedToday),
                })
              : t('expenses.budgetLeft', {
                  amount: format(plannedToday - spentToday),
                  budget: format(plannedToday),
                })}
          </p>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-ink/10">
            <div
              className={`h-full rounded-full ${
                spentToday > plannedToday ? 'bg-terracotta' : 'bg-sage'
              }`}
              style={{
                width: `${Math.min(100, plannedToday ? (spentToday / plannedToday) * 100 : 0)}%`,
              }}
            />
          </div>
          <p className="mt-2 text-xs text-ink/60">
            {t('expenses.totalSpent')}:{' '}
            <span data-testid="expense-total" className="font-semibold text-ink">
              {format(ledger.totalTry)}
            </span>
            {currency.code !== 'TRY' && ` (${formatTry(ledger.totalTry)})`}
          </p>
        </section>

        {/* ── Who owes whom ──────────────────────────────────────── */}
        <section className="mt-4" data-testid="expense-settlement">
          <h4 className="text-sm font-bold text-iznik">{t('expenses.settleTitle')}</h4>
          {ledger.debts.length === 0 ? (
            <p className="mt-1 text-sm text-ink/50">{t('expenses.settleSquare')}</p>
          ) : (
            <ul className="mt-1 space-y-1">
              {ledger.debts.map((d) => (
                <li
                  key={`${d.fromId}-${d.toId}`}
                  className="flex items-center justify-between rounded-lg bg-ink/5 px-3 py-2 text-sm text-ink"
                >
                  <span>
                    {t('expenses.settleLine', {
                      from: nameOf(d.fromId),
                      to: nameOf(d.toId),
                    })}
                  </span>
                  <span className="font-semibold">{format(d.amountTry)}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-1.5 text-[11px] text-ink/50">{t('expenses.settleNote')}</p>
        </section>

        {/* ── The rows ───────────────────────────────────────────── */}
        <section className="mt-4">
          <ListState
            status={status}
            empty={ledger.expenses.length === 0}
            emptyText={t('expenses.empty')}
            testId="expense-list"
          >
            <ul className="space-y-1.5">
              {ledger.expenses.map((e) => (
                <li
                  key={e.id}
                  className="rounded-lg bg-ink/5 px-3 py-2 text-sm text-ink"
                  data-testid="expense-row"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="min-w-0">
                      <span className="font-semibold">{t(`expenses.cat.${e.category}`)}</span>
                      {e.placeName && <span className="text-ink/60"> · {e.placeName}</span>}
                      {e.note && <span className="text-ink/60"> · {e.note}</span>}
                    </span>
                    <span className="flex flex-shrink-0 items-center gap-2 font-semibold">
                      {format(e.amountTry)}
                      <button
                        onClick={() => remove(e.id)}
                        aria-label={t('expenses.remove')}
                        className="text-ink/30 hover:text-terracotta"
                      >
                        ✕
                      </button>
                    </span>
                  </div>
                  <p className="text-[11px] text-ink/50">
                    {t('expenses.day', { day: String(e.dayIndex + 1) })} ·{' '}
                    {nameOf(e.paidByUserId)}
                    {e.participantIds.length > 1 &&
                      ` · ${e.participantIds.map(nameOf).join(', ')}`}
                  </p>
                  {/* What was actually paid, in the currency it was paid in,
                      with the rate that produced the lira figure. A converted
                      total with no rate beside it cannot be checked. */}
                  {e.rateToTry !== null && (
                    <p className="text-[11px] text-ink/50">
                      {e.enteredAmount} {e.enteredCurrency} ·{' '}
                      {e.rateSource === 'fallback'
                        ? t('expenses.rateFallback')
                        : t('expenses.rate', {
                            rate: e.rateToTry.toFixed(2),
                            currency: e.enteredCurrency,
                          })}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </ListState>
        </section>
          </>
        )}
      </div>
    </div>
  );
}

function buddyName(buddies: MessagingConnection[], id: string): string {
  return buddies.find((b) => b.userId === id)?.name ?? id.slice(0, 8);
}
