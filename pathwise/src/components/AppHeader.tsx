import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { WeatherWidget } from './WeatherWidget';
import { LanguageToggle } from './LanguageToggle';
import { NotificationBell } from './NotificationBell';
import { useT } from '../i18n';

/**
 * Top navigation.
 *
 * ── Why four links and a menu ────────────────────────────────────────
 * Measured on the running app before this changed: at a 375px viewport the nav
 * asked for 476px — it already overflowed the screen by a hundred pixels with
 * six links, and the header grew to 129px because the right-hand controls
 * wrapped onto a second row. Tours and Blog would have taken it past 640px.
 *
 * So the four things you *do* — plan, meet people, talk to them, and your own
 * account — stay visible, and the things you *read* move behind "More".
 * Premium sits in the same menu rather than beside them: it is an upsell, and
 * an upsell that permanently occupies a quarter of a phone's navigation is
 * worth less than the tab it displaces.
 */
const PRIMARY = [
  { to: '/dashboard', key: 'nav.plan' },
  { to: '/social', key: 'nav.social' },
  { to: '/messages', key: 'nav.messages' },
  { to: '/profile', key: 'nav.profile' },
] as const;

const SECONDARY = [
  { to: '/essentials', key: 'nav.essentials', emoji: '🎒' },
  { to: '/tours', key: 'nav.tours', emoji: '🎫' },
  { to: '/blog', key: 'nav.blog', emoji: '✍️' },
] as const;

export function AppHeader() {
  const { user, logout, isPremium } = useAuth();
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { pathname } = useLocation();

  // Navigating closes the menu. Without this it stays open over the new page,
  // because nothing unmounts between routes.
  useEffect(() => setOpen(false), [pathname]);

  // A click anywhere else, or Escape, closes it — the two ways people expect
  // to dismiss a menu they opened by accident.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `rounded-lg px-2.5 py-1.5 text-sm font-semibold transition-colors ${
      isActive ? 'bg-iznik/20 text-ink' : 'text-ink/60 hover:text-ink'
    }`;

  // The "More" button reads as active when the page behind it is one of its
  // own, so the current section is never unmarked.
  const inMenu =
    SECONDARY.some((l) => pathname.startsWith(l.to)) || pathname.startsWith('/premium');

  return (
    <header className="sticky top-0 z-[900] flex flex-wrap items-center justify-between gap-3 border-b border-ink/10 bg-surface/90 px-4 py-3 backdrop-blur md:px-6">
      <div className="flex items-center gap-4">
        <Link to="/dashboard" className="flex items-center gap-2">
          <span className="text-xl">🗺️</span>
          <span className="hidden font-display text-lg font-bold text-gradient sm:inline">
            Pathwise
          </span>
        </Link>
        <nav className="flex items-center gap-0.5">
          {PRIMARY.map((link) => (
            <NavLink key={link.to} to={link.to} className={linkClass}>
              {t(link.key)}
            </NavLink>
          ))}

          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              aria-haspopup="menu"
              className={`rounded-lg px-2.5 py-1.5 text-sm font-semibold transition-colors ${
                inMenu ? 'bg-iznik/20 text-ink' : 'text-ink/60 hover:text-ink'
              }`}
            >
              {t('nav.more')} <span aria-hidden="true">▾</span>
            </button>

            {open && (
              <div
                role="menu"
                data-testid="nav-more-menu"
                className="absolute right-0 z-[950] mt-1 w-48 overflow-hidden rounded-xl border border-ink/10 bg-surface shadow-lg"
              >
                {SECONDARY.map((link) => (
                  <NavLink
                    key={link.to}
                    to={link.to}
                    role="menuitem"
                    className={({ isActive }) =>
                      `block px-4 py-2.5 text-sm font-semibold transition-colors ${
                        isActive ? 'bg-iznik/15 text-ink' : 'text-ink/70 hover:bg-ink/5'
                      }`
                    }
                  >
                    <span aria-hidden="true">{link.emoji}</span> {t(link.key)}
                  </NavLink>
                ))}
                <NavLink
                  to="/premium"
                  role="menuitem"
                  className="block border-t border-ink/10 px-4 py-2.5 text-sm font-semibold text-iznik hover:bg-iznik/5"
                >
                  {isPremium ? '💎 Premium' : t('premium.nav')}
                </NavLink>
              </div>
            )}
          </div>
        </nav>
      </div>

      <div className="flex items-center gap-3">
        <div className="hidden md:block">
          <WeatherWidget />
        </div>
        <NotificationBell />
        <LanguageToggle />
        <div className="flex items-center gap-2">
          <span className="hidden text-sm text-ink/70 sm:inline">
            {user?.name?.split(' ')[0]}
          </span>
          <button
            onClick={logout}
            className="rounded-lg border border-ink/10 px-3 py-1.5 text-sm font-semibold text-ink/70 hover:text-ink"
          >
            {t('common.logout')}
          </button>
        </div>
      </div>
    </header>
  );
}
