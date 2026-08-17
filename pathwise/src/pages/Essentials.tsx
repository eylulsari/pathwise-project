import { AppHeader } from '../components/AppHeader';
import { useT } from '../i18n';

/**
 * Static reference content — the things a traveller needs to know before they
 * need them.
 *
 * Deliberately not backed by a table. Nothing here is per-user, nothing is
 * generated, and nothing changes between one visit and the next, so a database
 * round trip would buy a spinner and a failure mode in exchange for nothing.
 * The strings live in `translations.ts` like the rest of the UI copy, which is
 * also what makes them translate for free when more languages land.
 *
 * The mosque section is rendered again by `MosqueEtiquette`, on the detail
 * panel of any place whose `placeType` is `mosque`. Both read the same keys —
 * advice that exists twice in two wordings is advice that will disagree with
 * itself eventually.
 */

/** One section: a heading and its bullets. */
function Card({ title, items }: { title: string; items: string[] }) {
  return (
    <section className="rounded-2xl border border-ink/10 bg-surface-2 p-4">
      <h2 className="font-display text-base font-bold text-ink">{title}</h2>
      <ul className="mt-2 space-y-1.5">
        {items.map((item) => (
          <li key={item} className="flex gap-2 text-sm leading-relaxed text-ink/75">
            <span aria-hidden="true" className="text-ink/25">
              ·
            </span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function Essentials() {
  const { t } = useT();
  const items = (section: string, keys: string[]) =>
    keys.map((k) => t(`essentials.${section}.${k}`));

  return (
    <div className="min-h-screen bg-surface">
      <AppHeader />
      <main className="mx-auto max-w-3xl px-4 py-6">
        <header className="mb-4">
          <h1 className="font-display text-2xl font-bold text-ink">
            {t('essentials.title')}
          </h1>
          <p className="text-sm text-ink/50">{t('essentials.subtitle')}</p>
        </header>

        <div data-testid="essentials-list" className="grid gap-3">
          {/* The emergency number is one sentence and the first thing on the
              page: it is the only item here somebody might be reading in a
              hurry. */}
          <section className="rounded-2xl border border-clay/30 bg-clay/5 p-4">
            <h2 className="font-display text-base font-bold text-clay">
              🚨 {t('essentials.emergency.title')}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-ink/75">
              {t('essentials.emergency.body')}
            </p>
          </section>

          <Card
            title={`🕌 ${t('essentials.mosque.title')}`}
            items={items('mosque', ['i1', 'i2', 'i3', 'i4'])}
          />
          <Card
            title={`💷 ${t('essentials.tipping.title')}`}
            items={items('tipping', ['i1', 'i2', 'i3'])}
          />
          <Card
            title={`⚠️ ${t('essentials.caution.title')}`}
            items={items('caution', ['i1', 'i2', 'i3', 'i4'])}
          />
          <Card
            title={`🧭 ${t('essentials.practical.title')}`}
            items={items('practical', ['i1', 'i2', 'i3'])}
          />
        </div>
      </main>
    </div>
  );
}
