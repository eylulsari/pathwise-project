import { useEffect, useMemo, useState } from 'react';
import type {
  CheckIn,
  CommunityRoute,
  ForumQuestion,
  Traveler,
  TravelTag,
} from '../types';
import { api } from '../services/api';
import { AppHeader } from '../components/AppHeader';
import { TravelerModal } from '../components/social/TravelerModal';
import { HUB_LABEL } from '../utils/format';

const ALL_TAGS: TravelTag[] = [
  '#SoloVerified',
  '#Foodie',
  '#Backpacker',
  '#CultureSeeker',
  '#PhotoNomad',
  '#SlowTravel',
];

export default function Social() {
  const [checkIns, setCheckIns] = useState<CheckIn[]>([]);
  const [travelers, setTravelers] = useState<Traveler[]>([]);
  const [routes, setRoutes] = useState<CommunityRoute[]>([]);
  const [forum, setForum] = useState<ForumQuestion[]>([]);

  const [filter, setFilter] = useState<TravelTag | null>(null);
  const [connected, setConnected] = useState<Set<string>>(new Set());
  const [active, setActive] = useState<Traveler | null>(null);
  const [checkInText, setCheckInText] = useState('');

  useEffect(() => {
    api.getCheckIns().then(setCheckIns);
    api.getTravelers().then(setTravelers);
    api.getCommunityRoutes().then(setRoutes);
    api.getForum().then(setForum);
  }, []);

  const filtered = useMemo(
    () => (filter ? travelers.filter((t) => t.tags.includes(filter)) : travelers),
    [travelers, filter],
  );

  function toggleConnect(id: string) {
    setConnected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function broadcastCheckIn() {
    if (!checkInText.trim()) return;
    setCheckIns((prev) => [
      {
        id: `me-${Date.now()}`,
        traveler: { id: 'me', name: 'You', avatarColor: '#10B981' },
        placeName: 'Right here',
        hub: 'kadikoy-moda',
        message: checkInText.trim(),
        minutesAgo: 0,
      },
      ...prev,
    ]);
    setCheckInText('');
  }

  function likeRoute(id: string) {
    setRoutes((prev) =>
      prev.map((r) =>
        r.id === id
          ? { ...r, liked: !r.liked, likes: r.likes + (r.liked ? -1 : 1) }
          : r,
      ),
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 space-y-8 p-4 md:p-6">
        <div>
          <h1 className="font-display text-2xl font-bold">Social & Travel Buddies</h1>
          <p className="text-sm text-cream/60">Find verified travelers, clone routes and check in as you go.</p>
        </div>

        {/* "I'm Here" check-in composer */}
        <section className="rounded-2xl border border-white/10 bg-night-800 p-4">
          <div className="flex gap-2">
            <input
              value={checkInText}
              onChange={(e) => setCheckInText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && broadcastCheckIn()}
              placeholder="📍 I'm here — say what you're up to…"
              className="flex-1 rounded-xl border border-white/10 bg-night px-4 py-2.5 text-sm outline-none focus:border-emerald"
            />
            <button onClick={broadcastCheckIn} className="rounded-xl bg-emerald px-4 py-2.5 text-sm font-semibold text-white">
              I’m Here
            </button>
          </div>

          <div className="mt-4 space-y-2">
            {checkIns.map((c) => (
              <div key={c.id} className="flex items-start gap-3 rounded-xl bg-night px-3 py-2">
                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold text-white" style={{ background: c.traveler.avatarColor }}>
                  {c.traveler.name.split(' ').map((n) => n[0]).join('')}
                </div>
                <div className="text-sm">
                  <span className="font-semibold text-cream">{c.traveler.name}</span>
                  <span className="text-cream/50"> · {c.placeName} · {c.minutesAgo === 0 ? 'now' : `${c.minutesAgo}m ago`}</span>
                  <p className="text-cream/80">{c.message}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Traveler cards + filter */}
        <section>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <h2 className="font-display text-lg font-bold">Travelers nearby</h2>
            <div className="flex flex-wrap gap-1.5">
              <FilterChip label="All" active={filter === null} onClick={() => setFilter(null)} />
              {ALL_TAGS.map((t) => (
                <FilterChip key={t} label={t} active={filter === t} onClick={() => setFilter(t)} />
              ))}
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((t) => (
              <div key={t.id} className="card-cream p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full text-sm font-bold text-white" style={{ background: t.avatarColor }}>
                    {t.name.split(' ').map((n) => n[0]).join('')}
                  </div>
                  <div>
                    <p className="font-display font-bold text-night">{t.name}</p>
                    <p className="text-xs text-night/50">{t.age} · {t.nationality}</p>
                  </div>
                  {t.soloVerified && <span className="ml-auto text-emerald" title="Solo-Verified">✓</span>}
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {t.tags.slice(0, 3).map((tag) => (
                    <span key={tag} className="rounded-full bg-violet/10 px-2 py-0.5 text-[10px] font-semibold text-violet-deep">{tag}</span>
                  ))}
                </div>
                <div className="mt-3 flex gap-2">
                  <button onClick={() => toggleConnect(t.id)} className={`flex-1 rounded-lg py-2 text-xs font-semibold ${connected.has(t.id) ? 'bg-emerald/20 text-emerald' : 'bg-accent-gradient text-white'}`}>
                    {connected.has(t.id) ? '✓ Connected' : '👋 Connect'}
                  </button>
                  <button onClick={() => setActive(t)} className="flex-1 rounded-lg border border-night/15 py-2 text-xs font-semibold text-night hover:border-night/30">
                    View profile
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Community routes */}
        <section>
          <h2 className="mb-3 font-display text-lg font-bold">Community routes</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {routes.map((r) => (
              <div key={r.id} className="rounded-2xl border border-white/10 bg-night-800 p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-cream">{r.title}</p>
                    <p className="text-xs text-cream/50">by {r.authorName} · {HUB_LABEL[r.hub]}</p>
                  </div>
                  <span className="text-xs text-cream/50">{r.stops} stops · {r.distanceKm} km</span>
                </div>
                <div className="mt-3 flex gap-2">
                  <button onClick={() => likeRoute(r.id)} className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${r.liked ? 'bg-fuchsia/20 text-fuchsia' : 'border border-white/10 text-cream/70'}`}>
                    {r.liked ? '❤️' : '🤍'} {r.likes}
                  </button>
                  <button className="rounded-lg bg-violet/20 px-3 py-1.5 text-xs font-semibold text-cream">📋 Clone This Route</button>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Local Q&A forum */}
        <section>
          <h2 className="mb-3 font-display text-lg font-bold">Local Q&A</h2>
          <div className="space-y-3">
            {forum.map((q) => (
              <ForumThread key={q.id} q={q} />
            ))}
          </div>
        </section>
      </main>

      {active && (
        <TravelerModal
          traveler={active}
          connected={connected.has(active.id)}
          onConnect={() => toggleConnect(active.id)}
          onClose={() => setActive(null)}
        />
      )}
    </div>
  );
}

function FilterChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${active ? 'border-transparent bg-accent-gradient text-white' : 'border-white/15 text-cream/60 hover:border-white/30'}`}>
      {label}
    </button>
  );
}

function ForumThread({ q }: { q: ForumQuestion }) {
  const [answers, setAnswers] = useState(q.answers);
  const [text, setText] = useState('');
  return (
    <div className="rounded-2xl border border-white/10 bg-night-800 p-4">
      <p className="font-semibold text-cream">{q.question}</p>
      <p className="text-xs text-cream/50">{q.authorName} · {q.minutesAgo}m ago</p>
      <div className="mt-3 space-y-2 border-l-2 border-white/10 pl-3">
        {answers.map((a, i) => (
          <div key={i} className="text-sm">
            <span className="font-semibold text-violet">{a.authorName}</span>
            <span className="text-cream/50"> · {a.minutesAgo}m</span>
            <p className="text-cream/80">{a.text}</p>
          </div>
        ))}
      </div>
      <div className="mt-3 flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && text.trim()) {
              setAnswers((prev) => [...prev, { authorName: 'You', text: text.trim(), minutesAgo: 0 }]);
              setText('');
            }
          }}
          placeholder="Quick answer…"
          className="flex-1 rounded-lg border border-white/10 bg-night px-3 py-1.5 text-sm outline-none focus:border-violet"
        />
      </div>
    </div>
  );
}
