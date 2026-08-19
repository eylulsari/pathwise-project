import { useEffect, useRef, useState } from 'react';
import { api } from '../services/api';
import { useT } from '../i18n';
import { isRtl } from '../i18n/translations';

/**
 * A short spoken guide for a place, read by the browser.
 *
 * WHY THE BROWSER AND NOT AN AUDIO FILE
 * The server returns a script, not an MP3. Speech synthesis is built into
 * every browser this app supports: it costs nothing per play, needs no object
 * storage (this project has none), works offline once the script is cached,
 * and lets the traveller pick the voice and speed they can actually follow.
 * Generating audio server-side would add a storage bill and a delivery
 * problem for something the platform already does.
 *
 * WHY IT CAN VANISH
 * Places with no Wikipedia article get no narration, and neither do browsers
 * without speech synthesis. Both render nothing at all rather than a disabled
 * button that never explains itself.
 */
export function NarrationPlayer({ placeId }: { placeId: string }) {
  const { t, lang } = useT();
  const [script, setScript] = useState<string | null>(null);
  const [source, setSource] = useState<string | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'none' | 'error'>('loading');
  const [speaking, setSpeaking] = useState(false);

  // Whether the platform can speak at all. Checked once, not per render.
  const supported = useRef(
    typeof window !== 'undefined' && 'speechSynthesis' in window,
  ).current;

  useEffect(() => {
    let alive = true;
    setStatus('loading');
    setScript(null);
    api
      .getNarration(placeId, lang)
      .then((n) => {
        if (!alive) return;
        if (!n) {
          // No article, or narration not configured. A normal state.
          setStatus('none');
          return;
        }
        setScript(n.script);
        setSource(n.sourceTitle);
        setStatus('ready');
      })
      .catch(() => alive && setStatus('error'));
    return () => {
      alive = false;
      // Leaving the panel must stop the voice. Otherwise it keeps reading a
      // place the traveller has already closed.
      if (supported) window.speechSynthesis.cancel();
    };
  }, [placeId, lang, supported]);

  if (!supported || status === 'none' || status === 'loading') return null;

  if (status === 'error') {
    return (
      <p data-testid="narration-error" className="text-xs text-clay">
        {t('narration.failed')}
      </p>
    );
  }

  const speak = () => {
    if (!script) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(script);
    // Tell the engine which language this is, so it picks a voice that can
    // pronounce it rather than reading Turkish with an English one.
    utterance.lang = lang;
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    setSpeaking(true);
    window.speechSynthesis.speak(utterance);
  };

  const stop = () => {
    window.speechSynthesis.cancel();
    setSpeaking(false);
  };

  return (
    <div data-testid="narration-player" className="rounded-xl border border-ink/10 bg-surface-2 p-3">
      <div className="flex items-center gap-2">
        <button
          onClick={speaking ? stop : speak}
          data-testid="narration-toggle"
          className="rounded-lg bg-iznik px-3 py-1.5 text-xs font-semibold text-white"
        >
          {speaking ? `⏹ ${t('narration.stop')}` : `🔊 ${t('narration.play')}`}
        </button>
        <span className="text-xs text-ink/50">{t('narration.length')}</span>
      </div>

      {/* The script is on the page, not only in the audio: someone who cannot
          hear it, or is somewhere they cannot play it, still gets the guide.
          `dir` is set explicitly because this text is server-generated and its
          language is the user's, which need not match the page in every case. */}
      <p
        dir={isRtl(lang) ? 'rtl' : 'ltr'}
        data-testid="narration-script"
        className="mt-2 max-h-32 overflow-y-auto text-xs leading-relaxed text-ink/70"
      >
        {script}
      </p>

      {/* Where the facts came from. The narration is a rewording of this
          article, and saying so is what makes it checkable. */}
      {source && (
        <p className="mt-1 text-[11px] text-ink/45">
          {t('narration.source', { source })}
        </p>
      )}
    </div>
  );
}
