import { useEffect, useRef } from 'react';
import type { Itinerary } from '../types';
import { formatKm, formatTry } from '../utils/format';
import { useT } from '../i18n';

/**
 * Route-completion celebration: a lightweight canvas confetti burst (no
 * dependency) + a summary card, shown when every stop on Today's Path is
 * marked visited. Pastel Istanbul palette — colours mirror the Tailwind tokens.
 */

// Same hex values as the tailwind tokens (iznik / sunset / terracotta / mustard / sage).
const CONFETTI_COLORS = ['#4A7C82', '#8FC4BE', '#F4A896', '#F8C9B4', '#D98868', '#EAC873', '#9CBBA0'];

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  rot: number;
  vrot: number;
  round: boolean;
  life: number;
}

export function DayCelebration({
  itinerary,
  badge,
  onClose,
  onAddJournal,
}: {
  itinerary: Itinerary;
  badge?: { emoji: string; name: string } | null;
  onClose: () => void;
  onAddJournal?: () => void;
}) {
  const { t } = useT();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const stops = itinerary.stops.filter((s) => s.place).length;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      canvas.width = canvas.clientWidth;
      canvas.height = canvas.clientHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const particles: Particle[] = [];
    const burst = (n: number) => {
      const ox = canvas.width / 2;
      const oy = canvas.height * 0.32;
      for (let i = 0; i < n; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 4 + Math.random() * 7;
        particles.push({
          x: ox,
          y: oy,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 3, // bias upward, then gravity pulls down
          size: 5 + Math.random() * 6,
          color: CONFETTI_COLORS[(Math.random() * CONFETTI_COLORS.length) | 0],
          rot: Math.random() * Math.PI,
          vrot: (Math.random() - 0.5) * 0.3,
          round: Math.random() < 0.35,
          life: 1,
        });
      }
    };

    burst(140);
    const t2 = window.setTimeout(() => burst(90), 250);

    const gravity = 0.16;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const elapsed = now - start;
      for (const p of particles) {
        p.vy += gravity;
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vrot;
        if (elapsed > 1400) p.life -= 0.012; // fade out the tail end
        if (p.life <= 0) continue;
        ctx.save();
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        if (p.round) {
          ctx.beginPath();
          ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
        }
        ctx.restore();
      }
      if (elapsed < 4000) {
        raf = requestAnimationFrame(tick);
      } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    };
    raf = requestAnimationFrame(tick);

    return () => {
      window.clearTimeout(t2);
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full" />

      <div
        className="animate-pop card-cream relative z-10 w-full max-w-sm p-6 text-center shadow-soft-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-display text-2xl font-extrabold text-ink">{t('today.celebrateTitle')}</h2>
        <p className="mt-1 text-sm text-ink/60">{t('today.celebrateSub')}</p>

        <div className="mt-5 grid grid-cols-3 gap-2">
          <Stat tint="bg-iznik/10 text-iznik" value={String(stops)} label={t('today.statStops')} />
          <Stat tint="bg-sunset/20 text-terracotta" value={formatKm(itinerary.totalDistanceKm)} label={t('today.statDistance')} />
          <Stat tint="bg-mustard/20 text-ink" value={formatTry(itinerary.costBreakdown.totalTry)} label={t('today.statSpent')} />
        </div>

        {badge && (
          <div className="mt-4 flex items-center gap-3 rounded-2xl bg-accent-gradient p-3 text-start text-ink shadow-soft">
            <span className="text-3xl">{badge.emoji}</span>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-ink/70">
                {t('today.badgeUnlocked')}
              </p>
              <p className="font-display font-bold text-ink">{badge.name}</p>
            </div>
          </div>
        )}

        <div className="mt-6 flex gap-2">
          {onAddJournal && (
            <button onClick={onAddJournal} className="btn-accent flex-1 py-2.5 text-sm">
              {t('today.celebrateJournal')}
            </button>
          )}
          <button
            onClick={onClose}
            className={`rounded-xl border border-ink/15 py-2.5 text-sm font-semibold text-ink/70 hover:text-ink ${onAddJournal ? 'px-5' : 'flex-1'}`}
          >
            {t('today.celebrateClose')}
          </button>
        </div>
      </div>
    </div>
  );
}

function Stat({ tint, value, label }: { tint: string; value: string; label: string }) {
  return (
    <div className={`rounded-xl p-2.5 ${tint}`}>
      <div className="font-display text-lg font-bold leading-tight">{value}</div>
      <div className="text-[10px] font-semibold uppercase tracking-wide opacity-70">{label}</div>
    </div>
  );
}
