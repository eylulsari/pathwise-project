import { useT } from '../i18n';

/**
 * The mosque section of Essentials, shown where it is actually needed: on the
 * detail panel of a place that *is* a mosque.
 *
 * It reads the same four i18n keys as the Essentials page rather than
 * restating them, so the advice cannot drift into two versions — and it costs
 * no new data, because `placeType` already distinguishes the twenty mosques in
 * the catalogue.
 */
export function MosqueEtiquette() {
  const { t } = useT();
  const items = ['i1', 'i2', 'i3', 'i4'].map((k) => t(`essentials.mosque.${k}`));

  return (
    <aside
      data-testid="mosque-etiquette"
      className="mt-3 rounded-xl border border-iznik/25 bg-iznik/5 p-3"
    >
      <p className="text-xs font-semibold text-iznik">🕌 {t('essentials.mosque.title')}</p>
      <ul className="mt-1.5 space-y-1">
        {items.map((item) => (
          <li key={item} className="flex gap-1.5 text-[12px] leading-snug text-ink/70">
            <span aria-hidden="true" className="text-ink/30">
              ·
            </span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </aside>
  );
}
