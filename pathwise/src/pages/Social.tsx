import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
import { ReportButton } from '../components/social/ReportButton';
import { PollSection } from '../components/social/PollSection';
import { HUB_LABEL } from '../utils/format';
import { useT } from '../i18n';

const ALL_TAGS: TravelTag[] = [
  '#SoloVerified',
  '#Foodie',
  '#Backpacker',
  '#CultureSeeker',
  '#PhotoNomad',
  '#SlowTravel',
];

export default function Social() {
  const { t } = useT();
  const navigate = useNavigate();
  const [checkIns, setCheckIns] = useState<CheckIn[]>([]);
  const [travelers, setTravelers] = useState<Traveler[]>([]);
  const [routes, setRoutes] = useState<CommunityRoute[]>([]);
  const [forum, setForum] = useState<ForumQuestion[]>([]);

  const [filter, setFilter] = useState<TravelTag | null>(null);
  const [connected, setConnected] = useState<Set<string>>(new Set());
  const [active, setActive] = useState<Traveler | null>(null);
  const [checkInText, setCheckInText] = useState('');

  const didEmit = useRef(false);
  useEffect(() => {
    api.getCheckIns().then(setCheckIns);
    api.getTravelers().then(setTravelers);
    api.getCommunityRoutes().then(setRoutes);
    api.getForum().then(setForum);
    // A nearby check-in → Notification Center (B6). Guard the StrictMode
    // double-invoke so we don't emit twice.
    if (!didEmit.current) {
      didEmit.current = true;
      api.emitNotification('nearby');
    }
  }, []);

  const filtered = useMemo(
    () => (filter ? travelers.filter((t) => t.tags.includes(filter)) : travelers),
    [travelers, filter],
  );

  function toggleConnect(id: string) {
    setConnected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      // Persist connected buddy names so other features (e.g. the SOS
      // "share my location" alert) can target them without a global store.
      const names = travelers.filter((t) => next.has(t.id)).map((t) => t.name);
      localStorage.setItem('pathwise.buddies', JSON.stringify(names));
      return next;
    });
  }

  function broadcastCheckIn() {
    if (!checkInText.trim()) return;
    setCheckIns((prev) => [
      {
        id: `me-${Date.now()}`,
        traveler: { id: 'me', name: 'You', avatarColor: '#6E8F74' },
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

  // Clone a community route into the user's own plan: hand its hub off to the
  // dashboard (same localStorage handoff the poll winner uses) which rebuilds
  // Today's Path around that neighborhood.
  function cloneRoute(hub: CommunityRoute['hub']) {
    localStorage.setItem('pathwise.cloneHub', hub);
    navigate('/dashboard');
  }

  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 space-y-8 p-4 md:p-6">
        <div>
          <h1 className="font-display text-2xl font-bold">{t('social.title')}</h1>
          <p className="text-sm text-ink/60">{t('social.subtitle')}</p>
        </div>

        {/* "I'm Here" check-in composer */}
        <section className="rounded-2xl border border-ink/10 bg-surface-2 p-4">
          <div className="flex gap-2">
            <input
              value={checkInText}
              onChange={(e) => setCheckInText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && broadcastCheckIn()}
              placeholder={t('social.checkinPlaceholder')}
              className="flex-1 rounded-xl border border-ink/10 bg-white px-4 py-2.5 text-sm outline-none focus:border-sage"
            />
            <button onClick={broadcastCheckIn} className="rounded-xl bg-sage px-4 py-2.5 text-sm font-semibold text-ink">
              {t('social.imHere')}
            </button>
          </div>

          <div className="mt-4 space-y-2">
            {checkIns.map((c) => (
              <div key={c.id} className="flex items-start gap-3 rounded-xl bg-white px-3 py-2">
                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold text-white" style={{ background: c.traveler.avatarColor }}>
                  {c.traveler.name.split(' ').map((n) => n[0]).join('')}
                </div>
                <div className="flex-1 text-sm">
                  <span className="font-semibold text-ink">{c.traveler.name}</span>
                  <span className="text-ink/50"> · {c.placeName} · {c.minutesAgo === 0 ? 'now' : `${c.minutesAgo}m ago`}</span>
                  <p className="text-ink/80">{c.message}</p>
                </div>
                <ReportButton contentType="checkin" contentId={c.id} />
              </div>
            ))}
          </div>
        </section>

        {/* Traveler cards + filter */}
        <section>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <h2 className="font-display text-lg font-bold">{t('social.travelersNearby')}</h2>
            <div className="flex flex-wrap gap-1.5">
              <FilterChip label={t('social.all')} active={filter === null} onClick={() => setFilter(null)} />
              {ALL_TAGS.map((t) => (
                <FilterChip key={t} label={t} active={filter === t} onClick={() => setFilter(t)} />
              ))}
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((tr) => (
              <div key={tr.id} className="card-cream p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full text-sm font-bold text-white" style={{ background: tr.avatarColor }}>
                    {tr.name.split(' ').map((n) => n[0]).join('')}
                  </div>
                  <div>
                    <p className="font-display font-bold text-ink">{tr.name}</p>
                    <p className="text-xs text-ink/50">{tr.age} · {tr.nationality}</p>
                  </div>
                  {tr.soloVerified && <span className="ml-auto text-sage" title="Solo-Verified">✓</span>}
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {tr.tags.slice(0, 3).map((tag) => (
                    <span key={tag} className="rounded-full bg-iznik/10 px-2 py-0.5 text-[10px] font-semibold text-iznik">{tag}</span>
                  ))}
                </div>
                <div className="mt-3 flex gap-2">
                  <button onClick={() => toggleConnect(tr.id)} className={`flex-1 rounded-lg py-2 text-xs font-semibold ${connected.has(tr.id) ? 'bg-sage/20 text-sage' : 'bg-iznik text-white'}`}>
                    {connected.has(tr.id) ? t('social.connected') : t('social.connect')}
                  </button>
                  <button onClick={() => setActive(tr)} className="flex-1 rounded-lg border border-ink/15 py-2 text-xs font-semibold text-ink hover:border-ink/30">
                    {t('social.viewProfile')}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Group polls (B3) */}
        <PollSection />

        {/* Community routes */}
        <section>
          <h2 className="mb-3 font-display text-lg font-bold">{t('social.communityRoutes')}</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {routes.map((r) => (
              <div key={r.id} className="rounded-2xl border border-ink/10 bg-surface-2 p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-ink">{r.title}</p>
                    <p className="text-xs text-ink/50">by {r.authorName} · {HUB_LABEL[r.hub]}</p>
                  </div>
                  <span className="text-xs text-ink/50">{r.stops} stops · {r.distanceKm} km</span>
                </div>
                <div className="mt-3 flex gap-2">
                  <button onClick={() => likeRoute(r.id)} className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${r.liked ? 'bg-sunset/20 text-terracotta' : 'border border-ink/10 text-ink/70'}`}>
                    {r.liked ? '❤️' : '🤍'} {r.likes}
                  </button>
                  <button onClick={() => cloneRoute(r.hub)} className="rounded-lg bg-iznik/20 px-3 py-1.5 text-xs font-semibold text-ink">{t('social.clone')}</button>
                  <span className="ml-auto self-center"><ReportButton contentType="route" contentId={r.id} /></span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Local Q&A forum */}
        <section>
          <h2 className="mb-3 font-display text-lg font-bold">{t('social.localQA')}</h2>
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
    <button onClick={onClick} className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${active ? 'border-transparent bg-iznik text-white' : 'border-ink/15 text-ink/60 hover:border-ink/30'}`}>
      {label}
    </button>
  );
}

function ForumThread({ q }: { q: ForumQuestion }) {
  const { t } = useT();
  const [answers, setAnswers] = useState(q.answers);
  const [text, setText] = useState('');
  return (
    <div className="rounded-2xl border border-ink/10 bg-surface-2 p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="font-semibold text-ink">{q.question}</p>
        <ReportButton contentType="forum" contentId={q.id} />
      </div>
      <p className="text-xs text-ink/50">{q.authorName} · {q.minutesAgo}m ago</p>
      <div className="mt-3 space-y-2 border-l-2 border-ink/10 pl-3">
        {answers.map((a, i) => (
          <div key={i} className="text-sm">
            <span className="font-semibold text-iznik">{a.authorName}</span>
            <span className="text-ink/50"> · {a.minutesAgo}m</span>
            <p className="text-ink/80">{a.text}</p>
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
          placeholder={t('social.quickAnswer')}
          className="flex-1 rounded-lg border border-ink/10 bg-white px-3 py-1.5 text-sm outline-none focus:border-iznik"
        />
      </div>
    </div>
  );
}
