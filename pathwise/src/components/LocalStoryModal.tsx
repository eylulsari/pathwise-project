import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Place } from '../types';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { ReviewsSection } from './ReviewsSection';
import { PlaceEnrichmentPanel } from './PlaceEnrichmentPanel';
import { OpeningHours } from './OpeningHours';
import { PlaceFacts } from './PlaceFacts';
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
  const shortSummary = story.history ? story.history.split('. ')[0] + '.' : null;
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
  const words = story.transcript ? story.transcript.split(' ') : [];
  const wordsToShow = Math.ceil((progress / 100) * words.length);
  const transcript = words.slice(0, wordsToShow).join(' ');

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
            <h3 className="font-display text-xl font-bold text-ink">{place.name}</h3>
            <OpeningHours place={place} />
          </div>
          <button onClick={onClose} className="text-ink/40 hover:text-ink">✕</button>
        </div>

        {/* What this place is, from the record itself. Shown to everyone and
            never paywalled: these are plain facts, not editorial. */}
        <PlaceFacts place={place} />

        <section className="mt-4">
          <h4 className="text-sm font-bold text-iznik">📖 The story</h4>
          {story.history ? (
            <>
              <p className="mt-1 text-sm leading-relaxed text-ink/80">
                {isPremium ? story.history : shortSummary}
              </p>
              {!isPremium && (
                <button
                  onClick={() => { api.recordPaywall('story'); navigate('/premium'); }}
                  className="mt-1 text-xs font-semibold text-iznik hover:text-terracotta"
                >
                  {t('premium.unlock')}
                </button>
              )}
            </>
          ) : (
            // No paywall button here on purpose: there is nothing behind it to
            // unlock, and charging for an empty section would be a lie.
            <p className="mt-1 text-sm text-ink/50">{t('story.noneYet')}</p>
          )}
        </section>

        <section className="mt-4 rounded-xl bg-iznik/10 p-3">
          <h4 className="text-sm font-bold text-iznik">📸 Photo tip</h4>
          <p className="mt-1 text-sm text-ink/80">{story.photoTip}</p>
        </section>

        {/* Audio guide — full for premium, locked preview for free. Hidden
            entirely when there is no story to narrate: a padlock over an empty
            recording asks the user to pay for nothing. */}
        {story.transcript === null ? null : !isPremium ? (
          <section className="mt-4 rounded-xl border border-ink/10 bg-ink/5 p-4 text-center">
            <p className="text-sm font-semibold text-ink">🔒 {t('premium.fullAudio')}</p>
            <p className="mt-1 text-xs text-ink/60">{t('premium.shortOnly')}</p>
            <button onClick={() => { api.recordPaywall('story'); navigate('/premium'); }} className="btn-accent mt-3 px-4 py-2 text-xs">
              {t('premium.upgrade')}
            </button>
          </section>
        ) : (
        <section className="mt-4 rounded-xl border border-ink/10 p-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                if (progress >= 100) setProgress(0);
                setPlaying((p) => !p);
              }}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-iznik text-white"
              aria-label={playing ? 'Pause' : 'Play'}
            >
              {playing ? '❚❚' : '▶'}
            </button>
            <div className="flex-1">
              <div className="flex justify-between text-xs text-ink/50">
                <span>Audio guide preview</span>
                <span>0:{String(elapsed).padStart(2, '0')} / 0:15</span>
              </div>
              <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-ink/10">
                <div
                  className="h-full rounded-full bg-accent-gradient transition-[width] duration-100"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          </div>
          <p className="mt-3 min-h-[2.5rem] text-sm italic text-ink/70">
            {transcript || 'Press play to hear the 15-second preview…'}
            {playing && <span className="animate-pulse">▍</span>}
          </p>
          <p className="mt-1 text-[10px] uppercase tracking-wide text-ink/30">
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

/**
 * Story text for a place, or `null` where there is nothing real to say.
 *
 * This used to wrap every place in the same sentence — "Locals have gathered
 * here for generations, and it rewards a slower visit than most guidebooks
 * suggest" — with the curated tip dropped into the middle. Two thirds of the
 * catalogue has no curated tip, so most travellers were reading a claim about
 * a bike-hire stand or a café that nobody had made and nobody could check.
 *
 * So the story is now only ever the curated tip. Where there is none, the
 * modal says so and leans on the panel below it, which carries a real
 * Wikipedia summary for 65 places and cites where it came from.
 *
 * The photo tip stays for everyone: it is generic technique — bracket indoors,
 * shoot low in the morning — and asserts nothing about the place itself.
 */
function buildStory(place: Place): {
  history: string | null;
  photoTip: string;
  transcript: string | null;
} {
  const tip = place.localTip?.trim();
  return {
    history: tip
      ? `${place.name} is one of the anchors of ${labelHub(place.hub)}. ${tip}`
      : null,
    photoTip: place.isSunsetSpot
      ? 'Arrive ~45 minutes before sunset and shoot toward the water for warm backlight and long shadows.'
      : place.isIndoor
        ? 'Bracket your exposure for the interior light and brace against a column — tripods are usually not allowed.'
        : 'Shoot from a low angle in the morning to catch the texture of the street before the crowds arrive.',
    transcript: tip ? `Welcome to ${place.name}. ${tip}` : null,
  };
}

function labelHub(hub: string): string {
  const map: Record<string, string> = {
    sultanahmet: 'the Old City',
    'eminonu-sirkeci': 'Eminönü and the bazaar quarter',
    'beyoglu-taksim': 'Beyoğlu and İstiklal',
    'karakoy-galata': 'Karaköy and Galata',
    'besiktas-bogaz': 'Beşiktaş',
    'ortakoy-bebek': 'the Bosphorus shore',
    'balat-fener': 'Balat and Fener',
    'kadikoy-moda': 'Kadıköy and Moda',
    uskudar: 'Üsküdar',
    adalar: 'the Princes’ Islands',
  };
  return map[hub] ?? hub;
}
