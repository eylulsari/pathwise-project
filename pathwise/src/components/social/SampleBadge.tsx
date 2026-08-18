import { useT } from '../../i18n';

/**
 * The "this is demo data" chip.
 *
 * Extracted from the sample-profiles heading on the Social page so that every
 * surface showing fixture content — sample travellers, seed forum threads and
 * their seed answers, community routes — carries the *same* mark rather than
 * each inventing its own wording and colour. One component means one place to
 * change if the label ever needs to read differently, and no surface can drift
 * into looking more real than it is.
 *
 * `subtle` is for use inline next to an author's name, where the uppercase
 * chip would shout over the name it is qualifying.
 */
export function SampleBadge({ subtle = false }: { subtle?: boolean }) {
  const { t } = useT();
  const base = 'rounded-full bg-mustard/25 font-bold uppercase tracking-wide text-ink/70';
  return (
    <span
      data-testid="sample-badge"
      title={t('social.sampleNoAction')}
      className={
        subtle
          ? `${base} px-1.5 py-px text-[9px] align-middle`
          : `${base} px-2 py-0.5 text-[10px]`
      }
    >
      {t('social.sampleBadge')}
    </span>
  );
}
