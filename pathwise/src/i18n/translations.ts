/**
 * Translation dictionaries, one file per language under ./locales.
 *
 * UI chrome is translated; content that is effectively data — place names,
 * local tips, story text, backend-generated transport labels — stays as its
 * source provides it. ⚠️ PLACE NAMES ARE NEVER TRANSLATED in any language:
 * Ayasofya stays Ayasofya, Adalar stays Adalar. The names shown everywhere
 * else in the app come from the backend dataset, so a dictionary that
 * localised them would leave one place with two different names in one screen.
 *
 * `en` is the source of truth for the key set. `npm run i18n:check` fails the
 * build when any language drifts from it, which is what keeps a half-finished
 * language from quietly shipping English (or a raw key) into the UI.
 */
import { en } from './locales/en';
import { tr } from './locales/tr';
import { de } from './locales/de';
import { es } from './locales/es';
import { ru } from './locales/ru';
import { ar } from './locales/ar';

export const translations = { en, tr, de, es, ru, ar };

export type Lang = keyof typeof translations;

/**
 * Writing direction, as data rather than a check scattered through the UI.
 *
 * Arabic is the only right-to-left language here; the rest stay left-to-right.
 * Keeping it in one map means adding Hebrew or Persian later is a single line,
 * and no component has to know which languages those are.
 */
export const RTL_LANGS: readonly Lang[] = ['ar'];

export const isRtl = (lang: Lang): boolean => RTL_LANGS.includes(lang);

/**
 * What each language calls itself.
 *
 * Endonyms, not English names: someone looking for their own language scans
 * for the word they use for it, and "Deutsch" is findable to a German reader
 * in a way that "German" is not.
 */
export const LANG_LABELS: Record<Lang, string> = {
  en: 'English',
  tr: 'Türkçe',
  de: 'Deutsch',
  es: 'Español',
  ru: 'Русский',
  ar: 'العربية',
};

/** The short code shown on the compact switcher. */
export const LANG_SHORT: Record<Lang, string> = {
  en: 'EN',
  tr: 'TR',
  de: 'DE',
  es: 'ES',
  ru: 'RU',
  ar: 'ع',
};
