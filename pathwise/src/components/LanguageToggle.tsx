import { useT } from '../i18n';
import type { Lang } from '../i18n/translations';

/** TR / EN language switch. Persists via the i18n provider. */
export function LanguageToggle({ className = '' }: { className?: string }) {
  const { lang, setLang } = useT();
  const langs: Lang[] = ['en', 'tr'];
  return (
    <div className={`inline-flex overflow-hidden rounded-lg border border-white/15 text-xs font-semibold ${className}`}>
      {langs.map((l) => (
        <button
          key={l}
          onClick={() => setLang(l)}
          aria-pressed={lang === l}
          className={`px-2.5 py-1 transition-colors ${
            lang === l ? 'bg-accent-gradient text-white' : 'text-cream/60 hover:text-cream'
          }`}
        >
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
