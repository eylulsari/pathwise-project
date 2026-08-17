import { useCallback, useEffect, useRef, useState } from 'react';
import { AppHeader } from '../components/AppHeader';
import { ReportButton } from '../components/social/ReportButton';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import type { DirectMessage, MessagingConnection } from '../types';
import { useT } from '../i18n';

/**
 * Direct messages with connected buddies.
 *
 * Polling, not a socket. The API is stateless REST, the service sleeps when
 * idle so a long-lived connection would be torn down and rebuilt on every
 * wake, and there is no pub/sub to fan a socket across a second instance. An
 * open thread asks for what it has not seen every few seconds; that is cheap,
 * and it degrades to "slightly late" rather than to "silently disconnected".
 *
 * Nothing on this page is a permission. Every send and every read is checked
 * again on the server against the connection and the block list.
 */
const POLL_MS = 5000;

export default function Messages() {
  const { t } = useT();
  const { user } = useAuth();
  const [connections, setConnections] = useState<MessagingConnection[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [sendError, setSendError] = useState<string | null>(null);
  const bottom = useRef<HTMLDivElement | null>(null);

  const loadConnections = useCallback(async () => {
    try {
      setConnections(await api.listConnections());
      setFailed(false);
    } catch {
      // An empty list and a failed load are different things, and saying "no
      // conversations" when we simply do not know is the kind of quiet lie
      // that sends someone looking for a bug in the wrong place.
      setFailed(true);
    }
  }, []);

  useEffect(() => {
    void loadConnections();
  }, [loadConnections]);

  const active = connections?.find((c) => c.userId === activeId) ?? null;
  const canWrite = active?.status === 'accepted';

  /** Poll the open thread. Restarts whenever the conversation changes. */
  useEffect(() => {
    if (!activeId || !canWrite) {
      setMessages([]);
      return;
    }
    let alive = true;
    let timer: number;

    const tick = async () => {
      try {
        const rows = await api.getThread(activeId);
        if (alive) setMessages(rows);
      } catch {
        // A 403 here means the connection ended or a block landed while the
        // thread was open. Refresh the list rather than leaving a dead window
        // that still looks usable.
        if (alive) {
          setActiveId(null);
          void loadConnections();
        }
        return;
      }
      if (alive) timer = window.setTimeout(tick, POLL_MS);
    };
    void tick();
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [activeId, canWrite, loadConnections]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: 'end' });
  }, [messages.length]);

  async function send() {
    const body = draft.trim();
    if (!body || !activeId) return;
    setSendError(null);
    try {
      const saved = await api.sendMessage(activeId, body);
      setDraft('');
      setMessages((prev) => [...prev, saved]);
    } catch (err) {
      // Surfaced, not swallowed: a refusal here is the server enforcing a rule
      // and the person typing deserves to know their message did not go.
      setSendError(err instanceof Error ? err.message : String(err));
    }
  }

  async function block(userId: string) {
    await api.blockUser(userId).catch(() => {});
    setActiveId(null);
    setMessages([]);
    await loadConnections();
  }

  return (
    <div className="min-h-screen bg-surface">
      <AppHeader />
      <main className="mx-auto grid max-w-5xl gap-4 px-4 py-6 md:grid-cols-[260px_1fr]">
        <section className="rounded-2xl border border-ink/10 bg-surface-2 p-3">
          <h1 className="font-display text-lg font-bold text-ink">{t('dm.title')}</h1>
          <p className="mt-0.5 text-xs text-ink/50">{t('dm.subtitle')}</p>

          <div data-testid="dm-connections" className="mt-3 space-y-1">
            {connections === null && !failed && (
              <p className="text-sm text-ink/40">{t('dm.loading')}</p>
            )}
            {failed && <p className="text-sm text-terracotta">{t('dm.loadError')}</p>}
            {connections?.length === 0 && !failed && (
              <p className="text-sm leading-relaxed text-ink/40">{t('dm.empty')}</p>
            )}
            {connections?.map((c) => (
              <div key={c.userId} className="rounded-xl border border-ink/10 bg-surface p-2">
                <button
                  onClick={() => c.status === 'accepted' && setActiveId(c.userId)}
                  disabled={c.status !== 'accepted'}
                  className={`block w-full text-left text-sm font-semibold ${
                    c.userId === activeId ? 'text-iznik' : 'text-ink'
                  } disabled:cursor-default disabled:text-ink/50`}
                >
                  {c.name}
                </button>
                {c.status === 'pending-in' && (
                  <div className="mt-1 flex items-center gap-2">
                    <span className="text-[10px] text-ink/45">{t('dm.wantsToConnect')}</span>
                    <button
                      onClick={async () => {
                        await api.acceptConnection(c.userId).catch(() => {});
                        await loadConnections();
                      }}
                      className="rounded-lg bg-iznik px-2 py-0.5 text-[10px] font-semibold text-white"
                    >
                      {t('dm.accept')}
                    </button>
                  </div>
                )}
                {c.status === 'pending-out' && (
                  <span className="text-[10px] text-ink/45">{t('dm.awaitingReply')}</span>
                )}
              </div>
            ))}
          </div>
        </section>

        <section className="flex min-h-[60vh] flex-col rounded-2xl border border-ink/10 bg-surface-2 p-3">
          {!active || !canWrite ? (
            <p className="m-auto max-w-xs text-center text-sm text-ink/40">
              {t('dm.pickAConversation')}
            </p>
          ) : (
            <>
              <header className="flex items-center justify-between border-b border-ink/10 pb-2">
                <h2 className="font-display font-bold text-ink">{active.name}</h2>
                <button
                  onClick={() => block(active.userId)}
                  className="text-xs font-semibold text-ink/45 hover:text-terracotta"
                  title={t('dm.blockTip')}
                >
                  🚫 {t('dm.block')}
                </button>
              </header>

              <div data-testid="dm-thread" className="flex-1 space-y-2 overflow-y-auto py-3">
                {messages.length === 0 && (
                  <p className="text-sm text-ink/40">{t('dm.noMessagesYet')}</p>
                )}
                {messages.map((m) => {
                  const mine = m.senderId === user?.id;
                  return (
                    <div
                      key={m.id}
                      data-testid="dm-message"
                      className={`flex flex-col ${mine ? 'items-end' : 'items-start'}`}
                    >
                      <div
                        className={`max-w-[80%] whitespace-pre-wrap break-words rounded-2xl px-3 py-2 text-sm ${
                          mine ? 'bg-iznik text-white' : 'bg-surface text-ink'
                        }`}
                      >
                        {m.body}
                      </div>
                      {/* Reporting is one tap from the message itself, not
                          buried in a menu — a report that is hard to reach is
                          a report that does not get filed. */}
                      {!mine && (
                        <div className="mt-0.5">
                          <ReportButton contentType="message" contentId={m.id} />
                        </div>
                      )}
                    </div>
                  );
                })}
                <div ref={bottom} />
              </div>

              {sendError && (
                <p role="alert" className="pb-1 text-xs text-terracotta">
                  {sendError}
                </p>
              )}
              <form
                className="flex gap-2 border-t border-ink/10 pt-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  void send();
                }}
              >
                {/* Text only. There is no attachment control because there is
                    no attachment field — see the note on the messages table. */}
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  maxLength={2000}
                  placeholder={t('dm.placeholder')}
                  aria-label={t('dm.placeholder')}
                  className="flex-1 rounded-lg border border-ink/15 px-3 py-2 text-sm text-ink outline-none focus:border-iznik"
                />
                <button
                  type="submit"
                  disabled={!draft.trim()}
                  className="btn-accent px-4 py-2 text-sm disabled:opacity-40"
                >
                  {t('dm.send')}
                </button>
              </form>
            </>
          )}
        </section>
      </main>
    </div>
  );
}
