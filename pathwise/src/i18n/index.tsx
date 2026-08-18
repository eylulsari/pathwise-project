import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { translations, type Lang } from './translations';

const STORAGE_KEY = 'pathwise.lang';

function detectLang(): Lang {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved === 'tr' || saved === 'en') return saved;
  return navigator.language?.toLowerCase().startsWith('tr') ? 'tr' : 'en';
}

/** Resolve a dot-path like "dash.generate" against a nested dict. */
function resolve(dict: unknown, path: string): string | undefined {
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc && typeof acc === 'object' && key in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, dict) as string | undefined;
}

/** Values substituted into a string's `{placeholders}`. */
export type TVars = Record<string, string | number>;

interface I18nValue {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string, vars?: TVars) => string;
}

/**
 * Substitute `{name}` placeholders.
 *
 * Interpolation rather than concatenation in the caller, because word order is
 * not ours to assume: "3 stops moved" and "3 durak yeri değişti" put the number
 * in the same place, but plenty of strings do not, and a language added later
 * must be free to move it. A placeholder with no matching value is left as-is
 * rather than blanked — a visible `{count}` is a bug report, an empty space is
 * a mystery.
 */
function interpolate(text: string, vars?: TVars): string {
  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (whole, name: string) =>
    name in vars ? String(vars[name]) : whole,
  );
}

const I18nContext = createContext<I18nValue | undefined>(undefined);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(detectLang);

  const setLang = useCallback((l: Lang) => {
    localStorage.setItem(STORAGE_KEY, l);
    setLangState(l);
    document.documentElement.lang = l;
  }, []);

  const t = useCallback(
    (key: string, vars?: TVars): string =>
      interpolate(
        resolve(translations[lang], key) ??
          resolve(translations.en, key) ?? // fall back to English
          key, // last resort: show the key
        vars,
      ),
    [lang],
  );

  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useT(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useT must be used within an I18nProvider');
  return ctx;
}
