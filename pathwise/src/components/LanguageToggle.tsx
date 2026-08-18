import { useT } from '../i18n';
import { LANG_LABELS, type Lang } from '../i18n/translations';

/**
 * Language switcher. Persists via the i18n provider.
 *
 * A `<select>` rather than the row of buttons this used to be: two languages
 * fitted in a header, six do not, and on a phone they wrapped onto a second
 * line and pushed the notification bell off the row. A native select also
 * gets keyboard handling, a scrollable list and the platform's own long-press
 * behaviour for free, none of which a row of divs has.
 *
 * Each option is labelled with its endonym — someone looking for their own
 * language scans for the word they use for it, not for the English name.
 */
export function LanguageToggle({ className = '' }: { className?: string }) {
  const { lang, setLang, t } = useT();
  const langs = Object.keys(LANG_LABELS) as Lang[];
  return (
    <select
      value={lang}
      onChange={(e) => setLang(e.target.value as Lang)}
      aria-label={t('common.language')}
      data-testid="language-select"
      className={`rounded-lg border border-ink/15 bg-surface px-2 py-1 text-xs font-semibold text-ink/80 outline-none hover:border-ink/30 focus:border-iznik ${className}`}
    >
      {langs.map((l) => (
        <option key={l} value={l}>
          {LANG_LABELS[l]}
        </option>
      ))}
    </select>
  );
}
