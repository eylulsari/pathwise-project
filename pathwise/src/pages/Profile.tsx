import { useEffect, useState } from 'react';
import type { Badge, Hub, ProfileStats } from '../types';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { AppHeader } from '../components/AppHeader';
import { BUCKET_LIST_IDS, PAST_TRIPS } from '../mockData';
import { PLACES_BY_ID } from '../hubData';
import { HUB_LABEL, formatTry, formatKm } from '../utils/format';

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
  const [tab, setTab] = useState<Tab>('passport');
  const [badges, setBadges] = useState<Badge[]>([]);
  const [trips, setTrips] = useState<TripCard[]>([]);
  const [stats, setStats] = useState<ProfileStats | null>(null);

  useEffect(() => {
    api.getBadges().then(setBadges);
    api.getProfileStats().then(setStats);
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
        <div className="rounded-2xl bg-accent-gradient p-6 text-white">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/20 text-2xl font-bold">
              {user?.name?.split(' ').map((n) => n[0]).join('')}
            </div>
            <div>
              <h1 className="font-display text-2xl font-bold">{user?.name}</h1>
              <p className="text-white/80">{user?.nationality ?? 'Traveler'} · Istanbul explorer</p>
            </div>
          </div>
          {stats && (
            <div className="mt-5 grid grid-cols-3 gap-3">
              <Stat label="Total distance" value={formatKm(stats.totalKm)} />
              <Stat label="Stops visited" value={String(stats.stopsVisited)} />
              <Stat label="Total spent" value={formatTry(stats.spentTry)} />
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-2 border-b border-white/10">
          <TabButton active={tab === 'trips'} onClick={() => setTab('trips')}>Past Trips</TabButton>
          <TabButton active={tab === 'passport'} onClick={() => setTab('passport')}>İstanbul Passport</TabButton>
          <TabButton active={tab === 'spots'} onClick={() => setTab('spots')}>Visited Spots</TabButton>
        </div>

        {tab === 'trips' && (
          <div className="space-y-3">
            {trips.length === 0 && (
              <p className="rounded-xl border border-white/10 bg-night-800 p-4 text-sm text-cream/50">
                No trips yet — generate a plan and hit “💾 Save plan” to see it here.
              </p>
            )}
            {trips.some((t) => !t.saved) && (
              <p className="text-xs text-cream/40">Showing sample trips — save a plan to replace these with your own.</p>
            )}
            {trips.map((t) => (
              <div key={t.id} className="flex items-center justify-between rounded-2xl border border-white/10 bg-night-800 p-4">
                <div>
                  <p className="font-semibold text-cream">
                    {t.title}
                    {t.saved && <span className="ml-2 rounded-full bg-emerald/15 px-2 py-0.5 text-[10px] font-semibold text-emerald">Saved</span>}
                  </p>
                  <p className="text-xs text-cream/50">{HUB_LABEL[t.hub]}</p>
                </div>
                <div className="text-right text-sm">
                  <span className="rounded-full bg-violet/15 px-2.5 py-1 text-xs font-semibold text-violet">
                    {new Date(t.dateISO).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                  </span>
                  <p className="mt-1 text-cream/60">{formatKm(t.distanceKm)} · {t.stops} stops · {formatTry(t.spentTry)}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === 'passport' && (
          <div className="grid gap-3 sm:grid-cols-2">
            {badges.map((b) => (
              <div key={b.id} className={`rounded-2xl border p-4 ${b.earned ? 'border-emerald/40 bg-emerald/5' : 'border-white/10 bg-night-800'}`}>
                <div className="flex items-center gap-3">
                  <span className={`text-3xl ${b.earned ? '' : 'opacity-40 grayscale'}`}>{b.emoji}</span>
                  <div>
                    <p className="font-semibold text-cream">{b.name}</p>
                    <p className="text-xs text-cream/50">{b.description}</p>
                  </div>
                  {b.earned && <span className="ml-auto text-emerald">✓</span>}
                </div>
                {!b.earned && (
                  <div className="mt-3">
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-night">
                      <div className="h-full rounded-full bg-accent-gradient" style={{ width: `${b.progress}%` }} />
                    </div>
                    <p className="mt-1 text-right text-[10px] text-cream/40">{b.progress}%</p>
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
                <div key={id} className="flex items-center gap-3 rounded-xl border border-white/10 bg-night-800 p-3">
                  <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${visited ? 'bg-emerald text-white' : 'bg-night text-cream/30'}`}>
                    {visited ? '✓' : '○'}
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-cream">{place.name}</p>
                    <p className="text-xs text-cream/50">{HUB_LABEL[place.hub]}</p>
                  </div>
                  <span className={`ml-auto text-xs font-semibold ${visited ? 'text-emerald' : 'text-cream/40'}`}>
                    {visited ? 'Visited' : 'Not yet'}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white/15 p-3 text-center">
      <div className="font-display text-xl font-bold">{value}</div>
      <div className="text-xs text-white/70">{label}</div>
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`-mb-px border-b-2 px-4 py-2 text-sm font-semibold transition-colors ${
        active ? 'border-fuchsia text-cream' : 'border-transparent text-cream/50 hover:text-cream'
      }`}
    >
      {children}
    </button>
  );
}
