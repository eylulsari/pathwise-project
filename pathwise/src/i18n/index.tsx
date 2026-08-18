import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { isRtl, translations, type Lang } from './translations';

const STORAGE_KEY = 'pathwise.lang';

const isLang = (value: string | null): value is Lang =>
  value !== null && Object.prototype.hasOwnProperty.call(translations, value);

/**
 * The saved choice, else the browser's, else English.
 *
 * Matched on the primary subtag only, so `de-AT`, `es-419` and `ar-EG` all
 * land on the language we have rather than falling through to English on a
 * region we never listed.
 */
function detectLang(): Lang {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (isLang(saved)) return saved;
  const primary = navigator.language?.toLowerCase().split('-')[0] ?? '';
  return isLang(primary) ? primary : 'en';
}

/**
 * Tell the document what language it is in and which way it runs.
 *
 * `dir` belongs on the root element rather than in component classes: it is
 * what makes the browser lay out text, flex rows, scrollbars and form fields
 * the other way round, and setting it once means no component has to know
 * that Arabic exists. `lang` matters too — screen readers pick a voice from
 * it, and hyphenation follows it.
 */
function applyDocumentLang(lang: Lang): void {
  document.documentElement.lang = lang;
  document.documentElement.dir = isRtl(lang) ? 'rtl' : 'ltr';
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

  // Also on mount, not only on change: a reload restores the saved language
  // from localStorage without anyone calling setLang, and the document would
  // otherwise render Arabic left-to-right until the user switched away and
  // back again.
  useEffect(() => {
    applyDocumentLang(lang);
  }, [lang]);

  const setLang = useCallback((l: Lang) => {
    localStorage.setItem(STORAGE_KEY, l);
    setLangState(l);
    applyDocumentLang(l);
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
