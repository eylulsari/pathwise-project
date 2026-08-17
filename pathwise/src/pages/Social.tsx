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
import { CheckInMap } from '../components/social/CheckInMap';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { formatAge, isLive } from '../utils/presence';
import { ReportButton } from '../components/social/ReportButton';
import { ConnectRequestButton } from '../components/social/ConnectRequestButton';
import { useAuth } from '../context/AuthContext';
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
  // Whether the server could score this user at all (needs travel styles, or
  // saved trips to derive hubs/budget from). Drives the "improve your matches"
  // nudge — a thin profile should say so rather than show weak percentages
  // with no explanation.
  const [canMatch, setCanMatch] = useState(true);
  const [connected, setConnected] = useState<Set<string>>(new Set());
  const [active, setActive] = useState<Traveler | null>(null);
  const [checkInText, setCheckInText] = useState('');
  const [posting, setPosting] = useState(false);
  const [postFailed, setPostFailed] = useState(false);
  const [womenOnlyApplied, setWomenOnlyApplied] = useState(false);

  // Opt-in women-traveler mode. The chip is independent of the tag chips (they
  // combine), and it starts on for users who chose that in their profile.
  const { user } = useAuth();
  const womenModeEligible =
    user?.identifiesAsWoman === true &&
    (user?.visibleToWomenOnly === true || user?.showWomenOnly === true);
  const [womenOnly, setWomenOnly] = useState(false);
  useEffect(() => {
    setWomenOnly(user?.showWomenOnly === true);
  }, [user?.showWomenOnly]);

  const didEmit = useRef(false);
  useEffect(() => {
    api.getCheckIns().then(setCheckIns);
    api.getCommunityRoutes().then(setRoutes);
    api.getForum().then(setForum);
    // A nearby check-in → Notification Center (B6). Guard the StrictMode
    // double-invoke so we don't emit twice.
    if (!didEmit.current) {
      didEmit.current = true;
      api.emitNotification('nearby');
    }
  }, []);

  // The buddy list is refetched when the women-traveler filter changes: the
  // backend owns that filter (it also decides whether to honour it at all),
  // while the tag filter stays a client-side narrowing of the result.
  useEffect(() => {
    let active = true;
    api
      .getTravelers({ womenOnly, eligible: womenModeEligible })
      .then((res) => {
        if (!active) return;
        // Already ranked by the server (best match first) — the tag filter
        // below only narrows it and preserves that order.
        setTravelers(res.travelers);
        setWomenOnlyApplied(res.womenOnlyApplied);
        // The server owns this now — it is re-read on every load, so a
        // connection made on a phone shows up on a laptop.
        setConnected(new Set(res.connectedTravelerIds ?? []));
        const profile = res.viewerProfile;
        setCanMatch(
          !profile ||
            profile.styles.length > 0 ||
            profile.preferredHubs.length > 0 ||
            profile.budgetLevel !== null,
        );
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [womenOnly, womenModeEligible]);

  const filtered = useMemo(
    () => (filter ? travelers.filter((t) => t.tags.includes(filter)) : travelers),
    [travelers, filter],
  );

  /**
   * Connect / disconnect, persisted server-side.
   *
   * Optimistic: the button flips immediately and rolls back if the request
   * fails, because a connect is a small, reversible action and waiting a round
   * trip to acknowledge a tap feels broken. Both endpoints are idempotent, so
   * a rapid double tap cannot leave the server and the button disagreeing.
   */
  async function toggleConnect(id: string) {
    const wasConnected = connected.has(id);
    setConnected((prev) => {
      const next = new Set(prev);
      wasConnected ? next.delete(id) : next.add(id);
      return next;
    });
    try {
      if (wasConnected) await api.disconnectTraveler(id);
      else await api.connectTraveler(id);
    } catch {
      setConnected((prev) => {
        const next = new Set(prev);
        wasConnected ? next.add(id) : next.delete(id);
        return next;
      });
    }
  }

  /**
   * Post a check-in, then re-read the feed from the server.
   *
   * Refetching rather than splicing the response into local state: the server
   * owns the ordering (it merges the curated seed with every persisted row),
   * and reproducing that merge on the client would be a second implementation
   * of the same rule, free to drift. The cost is one extra request on an
   * action that happens rarely.
   */
  async function broadcastCheckIn() {
    const message = checkInText.trim();
    if (!message || posting) return;
    setPosting(true);
    try {
      await api.createCheckIn(message);
      setCheckIns(await api.getCheckIns());
      setCheckInText('');
    } catch {
      setPostFailed(true);
    } finally {
      setPosting(false);
    }
  }

  /**
   * Like / unlike a route.
   *
   * The count on screen is always the server's — it is derived there from the
   * like rows, so adding or subtracting one locally would be a second, drifting
   * implementation of the same number. A failed call simply leaves the card as
   * it was rather than showing a like that did not happen.
   */
  async function likeRoute(id: string) {
    const current = routes.find((r) => r.id === id);
    if (!current) return;
    try {
      const updated = await api.likeCommunityRoute(id, !current.liked);
      setRoutes((prev) => prev.map((r) => (r.id === id ? updated : r)));
    } catch {
      /* leave the card untouched — the server rejected or is unreachable */
    }
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
              onKeyDown={(e) => e.key === 'Enter' && void broadcastCheckIn()}
              placeholder={t('social.checkinPlaceholder')}
              className="flex-1 rounded-xl border border-ink/10 bg-white px-4 py-2.5 text-sm outline-none focus:border-sage"
            />
            <button
              onClick={() => void broadcastCheckIn()}
              disabled={posting}
              className="rounded-xl bg-sage px-4 py-2.5 text-sm font-semibold text-ink disabled:opacity-50"
            >
              {posting ? t('social.checkinPosting') : t('social.imHere')}
            </button>
          </div>
          {postFailed && (
            <p className="mt-2 text-xs font-semibold text-terracotta">
              {t('social.checkinFailed')}
            </p>
          )}

          <div className="mt-4 space-y-2">
            {checkIns.map((c) => {
              // Recomputed on every render rather than stored: presence is a
              // function of the clock, so a cached flag would go stale exactly
              // when it matters.
              const live = isLive(c.createdAt);
              return (
                <div
                  key={c.id}
                  data-testid="checkin-row"
                  data-presence={live ? 'live' : 'stale'}
                  className={`flex items-start gap-3 rounded-xl bg-white px-3 py-2 ${live ? '' : 'opacity-60'}`}
                >
                  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold text-white" style={{ background: c.traveler.avatarColor }}>
                    {c.traveler.name.split(' ').map((n) => n[0]).join('')}
                  </div>
                  <div className="flex-1 text-sm">
                    <span className="font-semibold text-ink">{c.traveler.name}</span>
                    {/* No place → an unplaced "right here" check-in. */}
                    <span className="text-ink/50"> · {c.placeName || t('social.rightHere')} · {formatAge(c.createdAt)}</span>
                    {live ? (
                      <span className="ml-2 whitespace-nowrap rounded-full bg-sage/20 px-2 py-0.5 text-[10px] font-semibold text-sage">
                        🟢 {t('presence.available')}
                      </span>
                    ) : (
                      <span className="ml-2 whitespace-nowrap rounded-full bg-ink/5 px-2 py-0.5 text-[10px] font-semibold text-ink/40">
                        {t('presence.stale')}
                      </span>
                    )}
                    <p className="text-ink/80">{c.message}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <ReportButton contentType="checkin" contentId={c.id} />
                    {/* The check-in feed is the only place in the app where
                        real accounts meet — the buddy list is a curated seed
                        with nobody behind it. So this is where asking to
                        connect belongs, and it is a request: the other person
                        has to accept before either of you can send anything. */}
                    {c.traveler.id !== user?.id && (
                      <ConnectRequestButton userId={c.traveler.id} />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Who is out there right now. Contained: a Leaflet failure must not
            take the rest of the social page with it. */}
        <ErrorBoundary label="checkin-map" fallback={null}>
          <CheckInMap checkIns={checkIns} />
        </ErrorBoundary>

        {/* Traveler cards + filter */}
        <section>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <h2 className="font-display text-lg font-bold">{t('social.travelersNearby')}</h2>
            <div className="flex flex-wrap gap-1.5">
              <FilterChip label={t('social.all')} active={filter === null} onClick={() => setFilter(null)} />
              {ALL_TAGS.map((tag) => (
                <FilterChip key={tag} label={tag} active={filter === tag} onClick={() => setFilter(tag)} />
              ))}
              {/* Independent of the tag chips above — the two combine. */}
              <FilterChip
                label={t('social.womenFilter')}
                active={womenOnly}
                disabled={!womenModeEligible}
                title={womenModeEligible ? undefined : t('social.womenNotOptedIn')}
                onClick={() => setWomenOnly((v) => !v)}
              />
            </div>
          </div>

          {/* The filter must never read as a vetted/verified set of people. */}
          {womenOnly && (
            <p className="mb-3 rounded-xl bg-mustard/15 px-3 py-2 text-xs leading-relaxed text-ink/70">
              {womenOnlyApplied ? t('social.womenDisclaimer') : t('social.womenNotOptedIn')}
            </p>
          )}
          {/* Nothing to match on yet — say so instead of showing a bare list. */}
          {!canMatch && (
            <p className="mb-3 rounded-xl bg-iznik/10 px-3 py-2 text-xs leading-relaxed text-ink/70">
              {t('social.matchEmptyProfile')}
            </p>
          )}
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
                  <span className="ml-auto flex items-center gap-1">
                    {/* Reciprocity: the backend only sends `identifiesAsWoman`
                        to viewers who opted in themselves, so this badge is
                        invisible to everyone else. */}
                    {tr.identifiesAsWoman && (
                      <span title={t('social.womenBadgeTitle')}>🚺</span>
                    )}
                    {tr.soloVerified && <span className="text-sage" title="Solo-Verified">✓</span>}
                  </span>
                </div>
                {/* Compatibility. Rendered only when the server could
                    actually compute one — never a made-up number. */}
                {typeof tr.matchScore === 'number' && (
                  <div className="mt-2.5" title={matchTitle(tr, t)}>
                    <div className="flex items-baseline justify-between">
                      <span className="text-[11px] font-semibold text-ink/60">
                        {t('social.matchLabel')}
                      </span>
                      <span className="font-display text-sm font-bold text-iznik">
                        %{tr.matchScore}
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-ink/10">
                      <div
                        className="h-full rounded-full bg-accent-gradient"
                        style={{ width: `${tr.matchScore}%` }}
                      />
                    </div>
                  </div>
                )}
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
                  <button onClick={() => void likeRoute(r.id)} className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${r.liked ? 'bg-sunset/20 text-terracotta' : 'border border-ink/10 text-ink/70'}`}>
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

/**
 * Hover text explaining a score. The percentage on its own is a black box;
 * naming the shared tags is what makes it trustworthy.
 */
function matchTitle(tr: Traveler, t: (key: string) => string): string {
  const shared = tr.sharedStyles ?? [];
  return shared.length > 0
    ? `${t('social.matchShared')}: ${shared.join(', ')}`
    : t('social.matchHow');
}

function FilterChip({
  label,
  active,
  onClick,
  disabled,
  title,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
        active
          ? 'border-transparent bg-iznik text-white'
          : 'border-ink/15 text-ink/60 hover:border-ink/30'
      } ${disabled ? 'cursor-not-allowed opacity-40 hover:border-ink/15' : ''}`}
    >
      {label}
    </button>
  );
}

function ForumThread({ q }: { q: ForumQuestion }) {
  const { t } = useT();
  // Seeded from the prop, then replaced by whatever the server returns — the
  // POST answers with the whole updated thread, so the client never has to
  // work out where its own answer belongs in the order.
  const [thread, setThread] = useState(q);
  const [text, setText] = useState('');
  const [posting, setPosting] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => setThread(q), [q]);

  async function submit() {
    const body = text.trim();
    if (!body || posting) return;
    setPosting(true);
    setFailed(false);
    try {
      setThread(await api.answerForum(q.id, body));
      setText('');
    } catch {
      setFailed(true);
    } finally {
      setPosting(false);
    }
  }

  return (
    <div className="rounded-2xl border border-ink/10 bg-surface-2 p-4" data-testid="forum-thread">
      <div className="flex items-start justify-between gap-2">
        <p className="font-semibold text-ink">{thread.question}</p>
        <ReportButton contentType="forum" contentId={thread.id} />
      </div>
      <p className="text-xs text-ink/50">{thread.authorName} · {formatAge(thread.createdAt)}</p>
      <div className="mt-3 space-y-2 border-l-2 border-ink/10 pl-3">
        {thread.answers.map((a, i) => (
          <div key={i} className="text-sm">
            <span className="font-semibold text-iznik">{a.authorName}</span>
            <span className="text-ink/50"> · {formatAge(a.createdAt)}</span>
            <p className="text-ink/80">{a.text}</p>
          </div>
        ))}
      </div>
      <div className="mt-3 flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && void submit()}
          disabled={posting}
          placeholder={t('social.quickAnswer')}
          className="flex-1 rounded-lg border border-ink/10 bg-white px-3 py-1.5 text-sm outline-none focus:border-iznik disabled:opacity-50"
        />
      </div>
      {failed && (
        <p className="mt-2 text-xs font-semibold text-terracotta">{t('social.answerFailed')}</p>
      )}
    </div>
  );
}
