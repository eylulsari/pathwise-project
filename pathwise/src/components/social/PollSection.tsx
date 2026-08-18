import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Poll } from '../../types';
import { api } from '../../services/api';
import { BUCKET_LIST_IDS } from '../../mockData';
import { PLACES_BY_ID } from '../../hubData';
import { useT } from '../../i18n';
import { ListState } from '../ListState';
import type { LoadStatus } from '../../hooks/useAsyncList';

/** Group poll (B3): start a poll, friends vote, winner → Today's Path. */
export function PollSection() {
  const { t } = useT();
  const navigate = useNavigate();
  const [polls, setPolls] = useState<Poll[]>([]);
  const [creating, setCreating] = useState(false);
  const [question, setQuestion] = useState('');
  const [picked, setPicked] = useState<string[]>([]);
  const [voted, setVoted] = useState<Set<string>>(new Set());

  /**
   * Which of the three the list is in — not two.
   *
   * The failure used to be swallowed entirely, and an empty list renders as
   * "No polls yet — start one and let friends vote." So a request that never
   * arrived was reported to the user as a fact about their group. That got
   * fixed; what stayed broken was the window before the *first* response, when
   * the list is legitimately empty and said "no polls yet" to a group that may
   * well have some. "We don't know yet", "we could not find out" and "there
   * are none" are three answers, and only one of them was ever true.
   */
  const [status, setStatus] = useState<LoadStatus>('loading');

  const loadSeq = useRef(0);
  const load = () => {
    // The load on mount and the load after creating a poll are both in flight
    // at once, and if the older one answers last it puts back a list from
    // before the new poll existed — which reads as the poll never having been
    // created at all.
    const ticket = ++loadSeq.current;
    return api
      .getPolls()
      .then((list) => {
        if (loadSeq.current !== ticket) return;
        setPolls(list);
        setStatus('ready');
      })
      .catch(() => {
        if (loadSeq.current !== ticket) return;
        setStatus('error');
      });
  };
  useEffect(() => { load(); }, []);

  async function create() {
    if (question.trim().length < 3 || picked.length < 2) return;
    const options = picked.map((id) => ({ placeId: id, label: PLACES_BY_ID[id]?.name ?? id }));
    await api.createPoll(question.trim(), options);
    setCreating(false);
    setQuestion('');
    setPicked([]);
    load();
  }

  /**
   * Newest write wins, per poll.
   *
   * Voting and closing are two writes to the same poll and a user can fire
   * them a moment apart. Whichever response arrives last used to be the one
   * that stuck, so a vote that came back slowly would overwrite the close that
   * had already been applied — the poll re-opened on screen, the winner and
   * the button to use it disappeared, and the server meanwhile held it closed.
   *
   * Each call takes a ticket before it starts; a response whose ticket is no
   * longer the current one describes a state that has since been superseded,
   * so it is read and dropped.
   */
  const seq = useRef<Record<string, number>>({});
  const claim = (pollId: string) => {
    const ticket = (seq.current[pollId] ?? 0) + 1;
    seq.current[pollId] = ticket;
    return () => seq.current[pollId] === ticket;
  };

  async function vote(poll: Poll, optionId: string) {
    const current = claim(poll.id);
    try {
      const updated = await api.votePoll(poll.id, optionId);
      // The vote itself happened regardless of what has landed since, and this
      // flag is what stops the user voting twice — so it is not conditional.
      setVoted((s) => new Set(s).add(poll.id));
      if (!current()) return;
      setPolls((prev) => prev.map((p) => (p.id === poll.id ? updated : p)));
    } catch { /* already voted / closed */ }
  }

  async function close(poll: Poll) {
    const current = claim(poll.id);
    const updated = await api.closePoll(poll.id);
    if (!current()) return;
    setPolls((prev) => prev.map((p) => (p.id === poll.id ? updated : p)));
  }

  function addWinner(placeId: string) {
    localStorage.setItem('pathwise.pollWinner', placeId);
    navigate('/dashboard');
  }

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-display text-lg font-bold">{t('poll.title')}</h2>
        <button onClick={() => setCreating(true)} className="rounded-lg bg-iznik px-3 py-1.5 text-xs font-semibold text-white">
          🗳️ {t('poll.start')}
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <ListState
          status={status}
          empty={polls.length === 0}
          emptyText={t('poll.empty')}
          errorText={t('poll.error')}
          testId="polls"
        >
        {polls.map((poll) => {
          const total = poll.options.reduce((s, o) => s + o.votes, 0);
          const winner = poll.winnerPlaceId ? PLACES_BY_ID[poll.winnerPlaceId] : null;
          return (
            <div key={poll.id} className="rounded-2xl border border-ink/10 bg-surface-2 p-4">
              <p className="font-semibold text-ink">{poll.question}</p>
              <div className="mt-2 space-y-1.5">
                {poll.options.map((o) => {
                  const pct = total ? Math.round((o.votes / total) * 100) : 0;
                  return (
                    <button
                      key={o.id}
                      onClick={() => vote(poll, o.id)}
                      disabled={poll.status === 'closed' || voted.has(poll.id)}
                      className="relative block w-full overflow-hidden rounded-lg border border-ink/10 px-3 py-1.5 text-start text-sm disabled:cursor-default"
                    >
                      <span className="absolute inset-y-0 start-0 bg-iznik/20" style={{ width: `${pct}%` }} />
                      <span className="relative flex justify-between text-ink/90">
                        <span>{o.label}</span>
                        <span className="text-ink/50">{o.votes} · {pct}%</span>
                      </span>
                    </button>
                  );
                })}
              </div>
              {poll.status === 'open' ? (
                <button onClick={() => close(poll)} className="mt-2 text-xs font-semibold text-terracotta hover:text-terracotta">
                  {t('poll.close')}
                </button>
              ) : winner ? (
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-xs font-semibold text-sage">🏆 {winner.name}</span>
                  <button onClick={() => addWinner(winner.placeId)} className="rounded-lg bg-sage/20 px-2 py-1 text-xs font-semibold text-sage">
                    {t('poll.addWinner')}
                  </button>
                </div>
              ) : null}
            </div>
          );
        })}
        </ListState>
      </div>

      {creating && (
        <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/70 p-4" onClick={() => setCreating(false)}>
          <div className="card-cream w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-display text-lg font-bold text-ink">🗳️ {t('poll.start')}</h3>
            <input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder={t('poll.questionPlaceholder')}
              className="mt-3 w-full rounded-lg border border-ink/15 px-3 py-2 text-ink outline-none focus:border-iznik"
            />
            <p className="mt-3 text-xs font-semibold text-ink/60">{t('poll.pickOptions')}</p>
            <div className="mt-1 grid max-h-40 grid-cols-2 gap-1 overflow-y-auto">
              {BUCKET_LIST_IDS.map((id) => {
                const p = PLACES_BY_ID[id];
                const on = picked.includes(id);
                return (
                  <button
                    key={id}
                    onClick={() => setPicked((prev) => on ? prev.filter((x) => x !== id) : prev.length < 4 ? [...prev, id] : prev)}
                    className={`rounded-lg border-2 px-2 py-1 text-start text-xs ${on ? 'border-iznik bg-iznik/10 text-ink' : 'border-ink/10 text-ink/70'}`}
                  >
                    {on ? '☑ ' : '☐ '}{p?.name}
                  </button>
                );
              })}
            </div>
            <button onClick={create} disabled={question.trim().length < 3 || picked.length < 2} className="btn-accent mt-4 w-full py-2 text-sm disabled:opacity-40">
              {t('poll.create')} ({picked.length})
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
