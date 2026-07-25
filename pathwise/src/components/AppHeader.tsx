import { Link, NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { WeatherWidget } from './WeatherWidget';
import { LanguageToggle } from './LanguageToggle';
import { NotificationBell } from './NotificationBell';
import { useT } from '../i18n';

/** Top navigation shared by Dashboard, Social and Profile. */
export function AppHeader() {
  const { user, logout, isPremium } = useAuth();
  const { t } = useT();

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${
      isActive ? 'bg-violet/20 text-cream' : 'text-cream/60 hover:text-cream'
    }`;

  return (
    <header className="sticky top-0 z-[900] flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-night/90 px-4 py-3 backdrop-blur md:px-6">
      <div className="flex items-center gap-4">
        <Link to="/dashboard" className="flex items-center gap-2">
          <span className="text-xl">🗺️</span>
          <span className="font-display text-lg font-bold text-gradient">Pathwise</span>
        </Link>
        <nav className="flex items-center gap-1">
          <NavLink to="/dashboard" className={linkClass}>{t('nav.plan')}</NavLink>
          <NavLink to="/social" className={linkClass}>{t('nav.social')}</NavLink>
          <NavLink to="/profile" className={linkClass}>{t('nav.profile')}</NavLink>
          <NavLink
            to="/premium"
            className={({ isActive }) =>
              `rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${
                isActive ? 'bg-violet/20 text-cream' : 'text-violet hover:text-fuchsia'
              }`
            }
          >
            {isPremium ? '💎 Premium' : t('premium.nav')}
          </NavLink>
        </nav>
      </div>

      <div className="flex items-center gap-3">
        <div className="hidden md:block">
          <WeatherWidget />
        </div>
        <NotificationBell />
        <LanguageToggle />
        <div className="flex items-center gap-2">
          <span className="hidden text-sm text-cream/70 sm:inline">
            {user?.name?.split(' ')[0]}
          </span>
          <button
            onClick={logout}
            className="rounded-lg border border-white/10 px-3 py-1.5 text-sm font-semibold text-cream/70 hover:text-cream"
          >
            {t('common.logout')}
          </button>
        </div>
      </div>
    </header>
  );
}
