import { Link } from 'react-router-dom';
import { IstanbulSilhouette } from '../components/IstanbulSilhouette';
import { LanguageToggle } from '../components/LanguageToggle';
import { useT } from '../i18n';

export default function Landing() {
  const { t } = useT();

  const features = [
    { icon: '🧭', title: t('landing.f1t'), body: t('landing.f1b') },
    { icon: '🗺️', title: t('landing.f2t'), body: t('landing.f2b') },
    { icon: '🌦️', title: t('landing.f3t'), body: t('landing.f3b') },
    { icon: '🤝', title: t('landing.f4t'), body: t('landing.f4b') },
  ];

  return (
    <div className="min-h-full flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-5 md:px-10">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🗺️</span>
          <span className="font-display text-xl font-bold text-gradient">Pathwise</span>
        </div>
        <div className="flex items-center gap-3">
          <LanguageToggle />
          <Link
            to="/auth"
            className="rounded-xl border border-iznik/40 px-4 py-2 text-sm font-semibold text-ink transition-colors hover:bg-iznik/10"
          >
            {t('landing.signIn')}
          </Link>
        </div>
      </header>

      {/* Hero */}
      <main className="flex flex-1 flex-col items-center justify-center px-6 text-center">
        <span className="mb-4 rounded-full border border-sunset/30 bg-sunset/10 px-4 py-1 text-xs font-semibold uppercase tracking-wider text-terracotta">
          {t('landing.badge')}
        </span>
        <h1 className="font-display text-5xl font-extrabold leading-tight md:text-7xl">
          {t('landing.hero1')}
          <br />
          <span className="text-gradient">{t('landing.hero2')}</span>
        </h1>
        <p className="mt-6 max-w-xl text-lg text-ink/70">{t('landing.subtitle')}</p>
        <Link to="/auth" className="btn-accent mt-8 text-lg">
          {t('landing.cta')}
        </Link>

        {/* Features */}
        <section className="mt-16 grid w-full max-w-5xl gap-4 md:grid-cols-4">
          {features.map((f) => (
            <div key={f.title} className="card-cream flex flex-col gap-2 p-5 text-start">
              <span className="text-3xl">{f.icon}</span>
              <h3 className="font-display text-lg font-bold">{f.title}</h3>
              <p className="text-sm text-ink/70">{f.body}</p>
            </div>
          ))}
        </section>
      </main>

      {/* Skyline footer */}
      <footer className="mt-16">
        <IstanbulSilhouette className="h-24 w-full text-iznik/30" />
      </footer>
    </div>
  );
}
