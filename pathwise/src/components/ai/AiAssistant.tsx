import { useState } from 'react';
import type { AiSuggestion } from '../../types';
import { api, type AiChatTurn } from '../../services/api';
import { formatTry } from '../../utils/format';

interface Message {
  role: 'user' | 'ai';
  text: string;
  suggestion?: AiSuggestion;
}

/** Keep the last N turns of context sent to the backend (matches its own cap). */
const HISTORY_TURNS = 8;

const CHIPS = [
  'Best sunset spot?',
  'Cheap eats nearby',
  'What if it rains?',
];

/** Floating AI assistant. Question chips, rich answer cards with cost + safety
 *  badge, and an "Add to Today's Path" action that locks the place into the
 *  route. */
export function AiAssistant({
  onAddToPath,
  activePlan = [],
}: {
  onAddToPath: (placeId: string) => void;
  /** Place names on Today's Path, sent to the backend for personalised replies. */
  activePlan?: string[];
}) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: 'ai', text: 'Hi! Ask me for a sunset spot, a cheap eat or a rainy-day plan.' },
  ]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);

  async function ask(q: string) {
    if (!q.trim() || busy) return;
    // Snapshot the conversation BEFORE adding this turn, so history is the
    // prior context. Skip the greeting and any suggestion-card-only turns.
    const history: AiChatTurn[] = messages
      .filter((m) => m.text.trim())
      .slice(-HISTORY_TURNS)
      .map((m) => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.text }],
      }));

    setMessages((m) => [...m, { role: 'user', text: q }]);
    setInput('');
    setBusy(true);
    try {
      const res = await api.askAssistant(q, history, activePlan);
      setMessages((m) => [...m, { role: 'ai', text: res.answer, suggestion: res.suggestion }]);
    } catch {
      setMessages((m) => [
        ...m,
        {
          role: 'ai',
          text: "Sorry — I couldn't reach the assistant just now. Please try again in a moment.",
        },
      ]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen((o) => !o)}
        className="fixed bottom-5 end-5 z-[1050] flex h-14 w-14 items-center justify-center rounded-full bg-iznik text-2xl shadow-soft-lg transition-transform hover:scale-105"
        aria-label="AI assistant"
      >
        {open ? '✕' : '🤖'}
      </button>

      {open && (
        <div className="fixed bottom-24 end-5 z-[1050] flex h-[28rem] w-[22rem] max-w-[90vw] flex-col overflow-hidden rounded-2xl border border-ink/10 bg-surface-2 shadow-2xl">
          <div className="bg-accent-gradient px-4 py-3 font-display font-bold text-ink">
            Pathwise Assistant
          </div>
          <div className="flex-1 space-y-3 overflow-y-auto p-3">
            {messages.map((m, i) => (
              <div key={i} className={m.role === 'user' ? 'text-end' : ''}>
                <span
                  className={`inline-block max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                    m.role === 'user' ? 'bg-iznik/30 text-ink' : 'bg-white text-ink/90'
                  }`}
                >
                  {m.text}
                </span>
                {m.suggestion && (
                  <div className="mt-2 rounded-xl border border-ink/10 bg-white p-3 text-start">
                    <p className="font-semibold text-ink">{m.suggestion.name}</p>
                    <p className="text-xs text-ink/60">{m.suggestion.reason}</p>
                    <div className="mt-2 flex items-center gap-2 text-xs">
                      <span className="rounded-full bg-ink/5 px-2 py-0.5 text-ink/80">{formatTry(m.suggestion.costTry)}</span>
                      <span className={`rounded-full px-2 py-0.5 font-semibold ${m.suggestion.safety === 'safe' ? 'bg-sage/20 text-sage' : 'bg-terracotta/20 text-terracotta'}`}>
                        {m.suggestion.safety === 'safe' ? '🛡️ Safe' : '⚠ Caution'}
                      </span>
                    </div>
                    <button
                      onClick={() => onAddToPath(m.suggestion!.placeId)}
                      className="mt-2 w-full rounded-lg bg-iznik py-1.5 text-xs font-semibold text-white"
                    >
                      ➕ Add to Today’s Path
                    </button>
                  </div>
                )}
              </div>
            ))}
            {busy && <p className="text-xs text-ink/40">Assistant is typing…</p>}
          </div>

          <div className="border-t border-ink/10 p-2">
            <div className="mb-2 flex flex-wrap gap-1.5">
              {CHIPS.map((c) => (
                <button key={c} onClick={() => ask(c)} className="rounded-full border border-ink/15 px-2 py-1 text-xs text-ink/70 hover:border-ink/30">
                  {c}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && ask(input)}
                placeholder="Ask anything…"
                className="flex-1 rounded-lg border border-ink/10 bg-white px-3 py-2 text-sm outline-none focus:border-iznik"
              />
              <button onClick={() => ask(input)} className="rounded-lg bg-iznik/30 px-3 text-sm font-semibold text-ink">→</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
