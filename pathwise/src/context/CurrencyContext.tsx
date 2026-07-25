import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { api } from '../services/api';

/**
 * Currency converter (B4). All money in the app is stored in TRY; this layer
 * converts it to a display currency. Rates come live from the backend
 * (Frankfurter via GET /currency/rates); the mock `perTry` values below are the
 * seed/fallback used until the fetch resolves or if it fails. The choice
 * persists in localStorage.
 */
export interface Currency {
  code: string;
  symbol: string;
  /** How much of this currency 1 TRY is worth (seeded mock, then live). */
  perTry: number;
}

export const CURRENCIES: Currency[] = [
  { code: 'TRY', symbol: '₺', perTry: 1 },
  { code: 'USD', symbol: '$', perTry: 0.031 },
  { code: 'EUR', symbol: '€', perTry: 0.028 },
  { code: 'GBP', symbol: '£', perTry: 0.024 },
];

const STORAGE_KEY = 'pathwise.currency';

interface CurrencyValue {
  currency: Currency;
  setCurrencyCode: (code: string) => void;
  currencies: Currency[];
  /** TRY amount → display string in the selected currency. */
  format: (tryAmount: number) => string;
}

const CurrencyContext = createContext<CurrencyValue | undefined>(undefined);

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [code, setCode] = useState<string>(
    () => localStorage.getItem(STORAGE_KEY) ?? 'TRY',
  );
  // Live rates keyed by code, seeded from the mock table. Replaced by the
  // backend feed on mount; on any failure the seed values simply remain.
  const [rates, setRates] = useState<Record<string, number>>(() =>
    Object.fromEntries(CURRENCIES.map((c) => [c.code, c.perTry])),
  );

  useEffect(() => {
    let alive = true;
    api
      .getCurrencyRates()
      .then((r) => {
        if (alive) setRates((prev) => ({ ...prev, TRY: 1, ...r.rates }));
      })
      .catch(() => {
        /* keep the seeded fallback rates — converter must not break */
      });
    return () => {
      alive = false;
    };
  }, []);

  const currency = useMemo(() => {
    const base = CURRENCIES.find((c) => c.code === code) ?? CURRENCIES[0];
    return { ...base, perTry: rates[base.code] ?? base.perTry };
  }, [code, rates]);

  const setCurrencyCode = useCallback((next: string) => {
    localStorage.setItem(STORAGE_KEY, next);
    setCode(next);
  }, []);

  const format = useCallback(
    (tryAmount: number): string => {
      const converted = tryAmount * currency.perTry;
      const rounded =
        currency.code === 'TRY'
          ? Math.round(converted)
          : Math.round(converted * 100) / 100;
      return `${currency.symbol}${rounded.toLocaleString('tr-TR')}`;
    },
    [currency],
  );

  const value = useMemo(
    () => ({ currency, setCurrencyCode, currencies: CURRENCIES, format }),
    [currency, setCurrencyCode, format],
  );

  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useCurrency(): CurrencyValue {
  const ctx = useContext(CurrencyContext);
  if (!ctx) throw new Error('useCurrency must be used within a CurrencyProvider');
  return ctx;
}
