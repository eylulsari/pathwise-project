import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Place } from '../types';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { ReviewsSection } from './ReviewsSection';
import { PlaceEnrichmentPanel } from './PlaceEnrichmentPanel';
import { useT } from '../i18n';

/**
 * "Read Local Story & Tips" modal. Free users get a short summary + a locked
 * audio guide; premium users get the full story and the full audio guide.
 * (The audio is still a SIMULATED progress-bar preview — no real file.)
 */
export function LocalStoryModal({
  place,
  onClose,
}: {
  place: Place;
  onClose: () => void;
}) {
  const { isPremium } = useAuth();
  const { t } = useT();
  const navigate = useNavigate();
  const story = buildStory(place);
  const shortSummary = story.history.split('. ')[0] + '.';
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0); // 0–100 over 15s
  const timer = useRef<number | null>(null);

  useEffect(() => {
    if (!playing) return;
    const step = 100 / (15 * 10); // 15s at 100ms ticks
    timer.current = window.setInterval(() => {
      setProgress((p) => {
        if (p + step >= 100) {
          window.clearInterval(timer.current!);
          setPlaying(false);
          return 100;
        }
        return p + step;
      });
    }, 100);
    return () => {
      if (timer.current) window.clearInterval(timer.current);
    };
  }, [playing]);

  const elapsed = Math.round((progress / 100) * 15);
  const wordsToShow = Math.ceil((progress / 100) * story.transcript.split(' ').length);
  const transcript = story.transcript.split(' ').slice(0, wordsToShow).join(' ');

  return (
    <div
      className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        className="card-cream max-h-[85vh] w-full max-w-lg overflow-y-auto p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-display text-xl font-bold text-night">{place.name}</h3>
            <p className="text-xs text-night/50">{place.openingHours}</p>
          </div>
          <button onClick={onClose} className="text-night/40 hover:text-night">✕</button>
        </div>

        <section className="mt-4">
          <h4 className="text-sm font-bold text-violet-deep">📖 The story</h4>
          <p className="mt-1 text-sm leading-relaxed text-night/80">
            {isPremium ? story.history : shortSummary}
          </p>
          {!isPremium && (
            <button
              onClick={() => { api.recordPaywall('story'); navigate('/premium'); }}
              className="mt-1 text-xs font-semibold text-violet hover:text-fuchsia"
            >
              {t('premium.unlock')}
            </button>
          )}
        </section>

        <section className="mt-4 rounded-xl bg-violet/10 p-3">
          <h4 className="text-sm font-bold text-violet-deep">📸 Photo tip</h4>
          <p className="mt-1 text-sm text-night/80">{story.photoTip}</p>
        </section>

        {/* Audio guide — full for premium, locked preview for free */}
        {!isPremium ? (
          <section className="mt-4 rounded-xl border border-night/10 bg-night/5 p-4 text-center">
            <p className="text-sm font-semibold text-night">🔒 {t('premium.fullAudio')}</p>
            <p className="mt-1 text-xs text-night/60">{t('premium.shortOnly')}</p>
            <button onClick={() => { api.recordPaywall('story'); navigate('/premium'); }} className="btn-accent mt-3 px-4 py-2 text-xs">
              {t('premium.upgrade')}
            </button>
          </section>
        ) : (
        <section className="mt-4 rounded-xl border border-night/10 p-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                if (progress >= 100) setProgress(0);
                setPlaying((p) => !p);
              }}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-accent-gradient text-white"
              aria-label={playing ? 'Pause' : 'Play'}
            >
              {playing ? '❚❚' : '▶'}
            </button>
            <div className="flex-1">
              <div className="flex justify-between text-xs text-night/50">
                <span>Audio guide preview</span>
                <span>0:{String(elapsed).padStart(2, '0')} / 0:15</span>
              </div>
              <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-night/10">
                <div
                  className="h-full rounded-full bg-accent-gradient transition-[width] duration-100"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          </div>
          <p className="mt-3 min-h-[2.5rem] text-sm italic text-night/70">
            {transcript || 'Press play to hear the 15-second preview…'}
            {playing && <span className="animate-pulse">▍</span>}
          </p>
          <p className="mt-1 text-[10px] uppercase tracking-wide text-night/30">
            💎 Full guide — simulated preview (no audio file is played)
          </p>
        </section>
        )}

        {/* Live enrichment — OSM tags + Wikipedia (silently hidden if absent) */}
        <PlaceEnrichmentPanel place={place} />

        {/* Community reviews — available to everyone (Phase 3) */}
        <ReviewsSection place={place} />
      </div>
    </div>
  );
}

/** Deterministic story/tip/transcript per place (would come from a CMS/LLM). */
function buildStory(place: Place): {
  history: string;
  photoTip: string;
  transcript: string;
} {
  return {
    history: `${place.name} is one of the anchors of ${labelHub(place.hub)}. ${place.localTip} Locals have gathered here for generations, and it rewards a slower visit than most guidebooks suggest.`,
    photoTip:
      place.isSunsetSpot
        ? 'Arrive ~45 minutes before sunset and shoot toward the water for warm backlight and long shadows.'
        : place.isIndoor
          ? 'Bracket your exposure for the interior light and brace against a column — tripods are usually not allowed.'
          : 'Shoot from a low angle in the morning to catch the texture of the street before the crowds arrive.',
    transcript: `Welcome to ${place.name}. As you stand here, imagine the layers of history beneath your feet. ${place.localTip} Take a moment, breathe it in, and when you're ready, your next stop is just a short walk away.`,
  };
}

function labelHub(hub: string): string {
  const map: Record<string, string> = {
    sultanahmet: 'the Old City',
    'karakoy-galata': 'Karaköy and Galata',
    'kadikoy-moda': 'Kadıköy and Moda',
    'balat-fener': 'Balat and Fener',
    'besiktas-bogaz': 'the Bosphorus shore',
  };
  return map[hub] ?? hub;
}
