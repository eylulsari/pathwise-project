import { useEffect, useState } from 'react';
import type { Badge, Hub, JournalSummary, ProfileStats } from '../types';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { AppHeader } from '../components/AppHeader';
import { SafetyPreferences } from '../components/SafetyPreferences';
import { PointsCard } from '../components/PointsCard';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { BUCKET_LIST_IDS, PAST_TRIPS } from '../mockData';
import { PLACES_BY_ID } from '../hubData';
import { HUB_LABEL, formatTry, formatKm } from '../utils/format';
import { useT } from '../i18n';

type Tab = 'trips' | 'passport' | 'spots';

/** Normalized card shape for both saved (backend) and demo (mock) trips. */
interface TripCard {
  id: string;
  title: string;
  hub: Hub;
  dateISO: string;
  distanceKm: number;
  stops: number;
  spentTry: number;
  saved: boolean;
}

export default function Profile() {
  const { user } = useAuth();
  const { t } = useT();
  const [tab, setTab] = useState<Tab>('passport');
  const [badges, setBadges] = useState<Badge[]>([]);
  const [trips, setTrips] = useState<TripCard[]>([]);
  const [stats, setStats] = useState<ProfileStats | null>(null);
  const [journal, setJournal] = useState<JournalSummary | null>(null);

  useEffect(() => {
    api.getBadges().then(setBadges);
    api.getProfileStats().then(setStats);
    api.getJournalSummary().then(setJournal).catch(() => {});
    // Prefer the user's real saved trips; fall back to demo trips if none yet.
    api
      .getTrips()
      .then((saved) => {
        if (saved.length > 0) {
          setTrips(
            saved.map((t) => ({
              id: t.id,
              title: t.title,
              hub: t.hub,
              dateISO: t.createdAt,
              distanceKm: t.totalDistanceKm,
              stops: t.stopCount,
              spentTry: t.totalCostTry,
              saved: true,
            })),
          );
        } else {
          setTrips(
            PAST_TRIPS.map((t) => ({
              id: t.id,
              title: t.title,
              hub: t.hub,
              dateISO: t.date,
              distanceKm: t.distanceKm,
              stops: t.stops,
              spentTry: t.spentTry,
              saved: false,
            })),
          );
        }
      })
      .catch(() => setTrips([]));
  }, []);

  // Visited-spot status derived from past trips' hubs (demo heuristic).
  const visitedHubs = new Set(trips.map((t) => t.hub));

  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader />
      <main className="mx-auto w-full max-w-4xl flex-1 space-y-6 p-4 md:p-6">
        {/* Header + stats */}
        <div className="rounded-2xl bg-accent-gradient p-6 text-ink shadow-soft">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/50 text-2xl font-bold">
              {user?.name?.split(' ').map((n) => n[0]).join('')}
            </div>
            <div>
              <h1 className="font-display text-2xl font-bold">{user?.name}</h1>
              <p className="text-ink/70">{user?.nationality ?? t('profile.traveler')} · {t('profile.explorer')}</p>
            </div>
          </div>
          {stats && (
            <div className="mt-5 grid grid-cols-3 gap-3">
              <Stat label={t('profile.totalDistance')} value={formatKm(stats.totalKm)} />
              <Stat label={t('profile.stopsVisited')} value={String(stats.stopsVisited)} />
              <Stat label={t('profile.totalSpent')} value={formatTry(stats.spentTry)} />
            </div>
          )}
        </div>

        {/* Reward points — above the tabs so the balance is visible on arrival
            rather than hidden behind a tab switch. */}
        <ErrorBoundary label="points-card" fallback={null}>
          <PointsCard />
        </ErrorBoundary>

        {/* Tabs */}
        <div className="flex gap-2 border-b border-ink/10">
          <TabButton active={tab === 'trips'} onClick={() => setTab('trips')}>{t('profile.pastTrips')}</TabButton>
          <TabButton active={tab === 'passport'} onClick={() => setTab('passport')}>{t('profile.passport')}</TabButton>
          <TabButton active={tab === 'spots'} onClick={() => setTab('spots')}>{t('profile.visitedSpots')}</TabButton>
        </div>

        {tab === 'trips' && (
          <div className="space-y-3">
            {journal && journal.entryCount > 0 && (
              <div className="rounded-2xl border border-sage/30 bg-sage/5 p-4 text-sm">
                <span className="font-display font-bold text-ink">📸 {t('journal.summary')}</span>
                <span className="ml-2 text-ink/70">
                  {journal.photoCount} {t('journal.photos')}, {journal.noteCount} {t('journal.notes')} · {t('journal.avg')} {journal.avgRating}★
                </span>
              </div>
            )}
            {trips.length === 0 && (
              <p className="rounded-xl border border-ink/10 bg-surface-2 p-4 text-sm text-ink/50">
                {t('profile.noTrips')}
              </p>
            )}
            {trips.some((tp) => !tp.saved) && (
              <p className="text-xs text-ink/40">{t('profile.sampleNote')}</p>
            )}
            {trips.map((tp) => (
              <div key={tp.id} className="flex items-center justify-between rounded-2xl border border-ink/10 bg-surface-2 p-4">
                <div>
                  <p className="font-semibold text-ink">
                    {tp.title}
                    {tp.saved && <span className="ml-2 rounded-full bg-sage/15 px-2 py-0.5 text-[10px] font-semibold text-sage">{t('profile.saved')}</span>}
                  </p>
                  <p className="text-xs text-ink/50">{HUB_LABEL[tp.hub]}</p>
                </div>
                <div className="text-right text-sm">
                  <span className="rounded-full bg-iznik/15 px-2.5 py-1 text-xs font-semibold text-iznik">
                    {new Date(tp.dateISO).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                  </span>
                  <p className="mt-1 text-ink/60">{formatKm(tp.distanceKm)} · {tp.stops} stops · {formatTry(tp.spentTry)}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === 'passport' && (
          <div className="grid gap-3 sm:grid-cols-2">
            {badges.map((b) => (
              <div key={b.id} className={`rounded-2xl border p-4 ${b.earned ? 'border-sage/40 bg-sage/5' : 'border-ink/10 bg-surface-2'}`}>
                <div className="flex items-center gap-3">
                  <span className={`text-3xl ${b.earned ? '' : 'opacity-40 grayscale'}`}>{b.emoji}</span>
                  <div>
                    <p className="font-semibold text-ink">{b.name}</p>
                    <p className="text-xs text-ink/50">{b.description}</p>
                  </div>
                  {b.earned && <span className="ml-auto text-sage">✓</span>}
                </div>
                {!b.earned && (
                  <div className="mt-3">
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-ink/10">
                      <div className="h-full rounded-full bg-accent-gradient" style={{ width: `${b.progress}%` }} />
                    </div>
                    <p className="mt-1 text-right text-[10px] text-ink/40">{b.progress}%</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {tab === 'spots' && (
          <div className="grid gap-2 sm:grid-cols-2">
            {BUCKET_LIST_IDS.map((id) => {
              const place = PLACES_BY_ID[id];
              if (!place) return null;
              const visited = visitedHubs.has(place.hub);
              return (
                <div key={id} className="flex items-center gap-3 rounded-xl border border-ink/10 bg-surface-2 p-3">
                  <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${visited ? 'bg-sage text-ink' : 'bg-ink/10 text-ink/40'}`}>
                    {visited ? '✓' : '○'}
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-ink">{place.name}</p>
                    <p className="text-xs text-ink/50">{HUB_LABEL[place.hub]}</p>
                  </div>
                  <span className={`ml-auto text-xs font-semibold ${visited ? 'text-sage' : 'text-ink/40'}`}>
                    {visited ? t('profile.visited') : t('profile.notYet')}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* Opt-in women-traveler mode — outside the tabs so it is reachable
            from any tab and never buried behind a content switch. The UI has
            not been driven end-to-end yet, so contain it: a quiet notice here
            is preferable to losing the whole profile page. */}
        <ErrorBoundary
          label="safety-preferences"
          fallback={
            <section className="rounded-2xl border border-ink/10 bg-surface-2 p-5">
              <p className="text-sm text-ink/60">{t('common.sectionUnavailable')}</p>
            </section>
          }
        >
          <SafetyPreferences />
        </ErrorBoundary>
      </main>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white/50 p-3 text-center">
      <div className="font-display text-xl font-bold">{value}</div>
      <div className="text-xs text-ink/60">{label}</div>
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`-mb-px border-b-2 px-4 py-2 text-sm font-semibold transition-colors ${
        active ? 'border-sunset text-ink' : 'border-transparent text-ink/50 hover:text-ink'
      }`}
    >
      {children}
    </button>
  );
}
