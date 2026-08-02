import { useState } from 'react';
import { api } from '../services/api';
import { EMERGENCY_NUMBER, POLICE_STATIONS } from '../mockData';
import { haversineMeters } from '../utils/geo';
import { useT } from '../i18n';

type Stage = 'idle' | 'confirm' | 'locating' | 'result';

interface ConnectedBuddy {
  name: string;
  /** Self-declared women-traveler status — see the note in SosButton below. */
  identifiesAsWoman: boolean;
}

/**
 * Connected buddies persisted by the Social page (demo — no backend table).
 * Accepts both the current object format and the original plain-string one so
 * a user who connected buddies before this change keeps their list.
 */
function connectedBuddies(): ConnectedBuddy[] {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem('pathwise.buddies') ?? '[]');
    if (!Array.isArray(raw)) return [];
    return raw.map((entry) =>
      typeof entry === 'string'
        ? { name: entry, identifiesAsWoman: false }
        : {
            name: String((entry as ConnectedBuddy)?.name ?? ''),
            identifiesAsWoman: (entry as ConnectedBuddy)?.identifiesAsWoman === true,
          },
    );
  } catch {
    return [];
  }
}

/**
 * 🆘 SOS / safety button (Phase 2). A distinct red button with a confirm step
 * (to prevent accidental presses), then shows the emergency number, the nearest
 * tourist police, and a "share my location" action that alerts connected
 * buddies via the Notification Center. Real SMS/authority routing = later phase.
 */
export function SosButton() {
  const { t } = useT();
  const [stage, setStage] = useState<Stage>('idle');
  const [pos, setPos] = useState<{ lat: number; lng: number } | null>(null);
  const [shared, setShared] = useState(false);
  // Optional narrowing of the share. Off by default: in an emergency the
  // widest reach is the safer default, so this is never pre-selected.
  //
  // ⚠️ Filters on a SELF-DECLARED flag — no identity verification backs it.
  const [womenBuddiesOnly, setWomenBuddiesOnly] = useState(false);

  const allBuddies = connectedBuddies();
  const womenBuddies = allBuddies.filter((b) => b.identifiesAsWoman);
  const buddies = womenBuddiesOnly ? womenBuddies : allBuddies;
  const nearest = pos
    ? [...POLICE_STATIONS].sort(
        (a, b) => haversineMeters(pos, a) - haversineMeters(pos, b),
      )[0]
    : null;
  const nearestDistM = pos && nearest ? Math.round(haversineMeters(pos, nearest)) : 0;

  function locate() {
    setStage('locating');
    const fallback = { lat: 41.0082, lng: 28.9784 }; // Sultanahmet, if GPS denied
    if (!navigator.geolocation) {
      setPos(fallback);
      setStage('result');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setPos({ lat: p.coords.latitude, lng: p.coords.longitude });
        setStage('result');
      },
      () => {
        setPos(fallback);
        setStage('result');
      },
      { timeout: 8000 },
    );
  }

  async function share() {
    if (!pos) return;
    await api
      .sendSosAlert({
        lat: pos.lat,
        lng: pos.lng,
        share: true,
        sharedWithUserIds: buddies.map((b) => b.name),
      })
      .catch(() => {});
    window.dispatchEvent(new Event('pw-notify')); // refresh the bell
    setShared(true);
  }

  function reset() {
    setStage('idle');
    setPos(null);
    setShared(false);
  }

  return (
    <>
      <button
        onClick={() => setStage('confirm')}
        className="absolute bottom-3 right-3 z-[1001] flex items-center gap-1 rounded-full bg-red-600 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-red-900/50 ring-2 ring-red-400/50 transition-transform hover:scale-105"
        title="SOS"
      >
        🆘 SOS
      </button>

      {stage === 'confirm' && (
        <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/70 p-4" onClick={reset}>
          <div className="card-cream w-full max-w-sm p-6 text-center" onClick={(e) => e.stopPropagation()}>
            <div className="text-4xl">🆘</div>
            <h3 className="mt-2 font-display text-xl font-bold text-ink">{t('sos.confirmTitle')}</h3>
            <p className="mt-1 text-sm text-ink/60">{t('sos.confirmBody')}</p>
            <div className="mt-5 flex gap-2">
              <button onClick={reset} className="flex-1 rounded-xl border-2 border-ink/15 py-2.5 text-sm font-semibold text-ink">
                {t('sos.cancel')}
              </button>
              <button onClick={locate} className="flex-1 rounded-xl bg-red-600 py-2.5 text-sm font-bold text-white">
                {t('sos.confirm')}
              </button>
            </div>
          </div>
        </div>
      )}

      {(stage === 'locating' || stage === 'result') && (
        <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/70 p-4" onClick={reset}>
          <div className="card-cream w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between">
              <h3 className="font-display text-lg font-bold text-red-600">🆘 {t('sos.title')}</h3>
              <button onClick={reset} className="text-ink/40 hover:text-ink">✕</button>
            </div>

            {stage === 'locating' ? (
              <p className="mt-4 animate-pulse text-sm text-ink/60">{t('sos.locating')}</p>
            ) : (
              <div className="mt-4 space-y-3">
                <a href={`tel:${EMERGENCY_NUMBER}`} className="flex items-center justify-between rounded-xl bg-red-600 px-4 py-3 text-white">
                  <span className="text-sm font-semibold">{t('sos.emergency')}</span>
                  <span className="font-display text-xl font-bold">📞 {EMERGENCY_NUMBER}</span>
                </a>

                {nearest && (
                  <div className="rounded-xl border border-ink/10 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-ink/40">{t('sos.nearestPolice')}</p>
                    <p className="mt-0.5 text-sm font-semibold text-ink">👮 {nearest.name}</p>
                    <p className="text-xs text-ink/60">{nearest.phone} · {(nearestDistM / 1000).toFixed(1)} km</p>
                  </div>
                )}

                {shared ? (
                  <p className="rounded-xl bg-sage/15 px-3 py-2 text-center text-sm font-semibold text-sage">
                    ✓ {buddies.length > 0 ? t('sos.shared') : t('sos.sharedNoBuddies')}
                  </p>
                ) : (
                  <div className="space-y-2">
                    <button onClick={share} className="btn-accent w-full py-2.5 text-sm">
                      📍 {t('sos.share')}{buddies.length > 0 ? ` (${buddies.length})` : ''}
                    </button>
                    {/* Sub-option of "share my location" — narrows the same
                        connected-buddy list, no extra backend table needed. */}
                    {allBuddies.length > 0 && (
                      <label className="flex cursor-pointer items-start gap-2 px-1 text-xs text-ink/70">
                        <input
                          type="checkbox"
                          checked={womenBuddiesOnly}
                          onChange={(e) => setWomenBuddiesOnly(e.target.checked)}
                          className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 accent-iznik"
                        />
                        <span>
                          {t('sos.shareWomenOnly')}
                          {womenBuddiesOnly && womenBuddies.length === 0 && (
                            <span className="block text-terracotta">{t('sos.shareWomenNone')}</span>
                          )}
                        </span>
                      </label>
                    )}
                  </div>
                )}
                <p className="text-center text-[10px] text-ink/40">{t('sos.demoNote')}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
