import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

/**
 * Currency converter (B4). All money in the app is stored in TRY; this layer
 * converts it to a display currency using a MOCK rate table (real FX feed is a
 * later phase). The choice persists in localStorage.
 */
export interface Currency {
  code: string;
  symbol: string;
  /** How much of this currency 1 TRY is worth (mock, mid-2026). */
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

  const currency = useMemo(
    () => CURRENCIES.find((c) => c.code === code) ?? CURRENCIES[0],
    [code],
  );

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
