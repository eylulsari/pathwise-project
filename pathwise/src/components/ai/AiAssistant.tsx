import { useState } from 'react';
import type { AiSuggestion } from '../../types';
import { api } from '../../services/api';
import { formatTry } from '../../utils/format';

interface Message {
  role: 'user' | 'ai';
  text: string;
  suggestion?: AiSuggestion;
}

const CHIPS = [
  'Best sunset spot?',
  'Cheap eats nearby',
  'What if it rains?',
];

/** Floating AI assistant. Question chips, rich answer cards with cost + safety
 *  badge, and an "Add to Today's Path" action that locks the place into the
 *  route. */
export function AiAssistant({ onAddToPath }: { onAddToPath: (placeId: string) => void }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: 'ai', text: 'Hi! Ask me for a sunset spot, a cheap eat or a rainy-day plan.' },
  ]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);

  async function ask(q: string) {
    if (!q.trim()) return;
    setMessages((m) => [...m, { role: 'user', text: q }]);
    setInput('');
    setBusy(true);
    const res = await api.askAssistant(q);
    setMessages((m) => [...m, { role: 'ai', text: res.answer, suggestion: res.suggestion }]);
    setBusy(false);
  }

  return (
    <>
      <button
        onClick={() => setOpen((o) => !o)}
        className="fixed bottom-5 right-5 z-[1050] flex h-14 w-14 items-center justify-center rounded-full bg-accent-gradient text-2xl shadow-xl shadow-fuchsia/30 transition-transform hover:scale-105"
        aria-label="AI assistant"
      >
        {open ? '✕' : '🤖'}
      </button>

      {open && (
        <div className="fixed bottom-24 right-5 z-[1050] flex h-[28rem] w-[22rem] max-w-[90vw] flex-col overflow-hidden rounded-2xl border border-white/10 bg-night-800 shadow-2xl">
          <div className="bg-accent-gradient px-4 py-3 font-display font-bold text-white">
            Pathwise Assistant
          </div>
          <div className="flex-1 space-y-3 overflow-y-auto p-3">
            {messages.map((m, i) => (
              <div key={i} className={m.role === 'user' ? 'text-right' : ''}>
                <span
                  className={`inline-block max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                    m.role === 'user' ? 'bg-violet/30 text-cream' : 'bg-night text-cream/90'
                  }`}
                >
                  {m.text}
                </span>
                {m.suggestion && (
                  <div className="mt-2 rounded-xl border border-white/10 bg-night p-3 text-left">
                    <p className="font-semibold text-cream">{m.suggestion.name}</p>
                    <p className="text-xs text-cream/60">{m.suggestion.reason}</p>
                    <div className="mt-2 flex items-center gap-2 text-xs">
                      <span className="rounded-full bg-white/10 px-2 py-0.5 text-cream/80">{formatTry(m.suggestion.costTry)}</span>
                      <span className={`rounded-full px-2 py-0.5 font-semibold ${m.suggestion.safety === 'safe' ? 'bg-emerald/20 text-emerald' : 'bg-coral/20 text-coral'}`}>
                        {m.suggestion.safety === 'safe' ? '🛡️ Safe' : '⚠ Caution'}
                      </span>
                    </div>
                    <button
                      onClick={() => onAddToPath(m.suggestion!.placeId)}
                      className="mt-2 w-full rounded-lg bg-accent-gradient py-1.5 text-xs font-semibold text-white"
                    >
                      ➕ Add to Today’s Path
                    </button>
                  </div>
                )}
              </div>
            ))}
            {busy && <p className="text-xs text-cream/40">Assistant is typing…</p>}
          </div>

          <div className="border-t border-white/10 p-2">
            <div className="mb-2 flex flex-wrap gap-1.5">
              {CHIPS.map((c) => (
                <button key={c} onClick={() => ask(c)} className="rounded-full border border-white/15 px-2 py-1 text-xs text-cream/70 hover:border-white/30">
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
                className="flex-1 rounded-lg border border-white/10 bg-night px-3 py-2 text-sm outline-none focus:border-violet"
              />
              <button onClick={() => ask(input)} className="rounded-lg bg-violet/30 px-3 text-sm font-semibold text-cream">→</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
