import type { Traveler } from '../../types';
import { BADGES } from '../../mockData';
import { TurkeyMiniMap } from '../TurkeyMiniMap';

/** Traveler profile modal — bio, badges, visited provinces map and a DM button. */
export function TravelerModal({
  traveler,
  connected,
  onConnect,
  onClose,
}: {
  traveler: Traveler;
  connected: boolean;
  onConnect: () => void;
  onClose: () => void;
}) {
  const badges = BADGES.filter((b) => traveler.badges.includes(b.id));

  return (
    <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div className="card-cream max-h-[88vh] w-full max-w-lg overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div
              className="flex h-14 w-14 items-center justify-center rounded-full text-xl font-bold text-white"
              style={{ background: traveler.avatarColor }}
            >
              {traveler.name.split(' ').map((n) => n[0]).join('')}
            </div>
            <div>
              <h3 className="font-display text-xl font-bold text-night">{traveler.name}</h3>
              <p className="text-sm text-night/60">
                {traveler.age} · {traveler.nationality}
                {traveler.soloVerified && (
                  <span className="ml-2 rounded-full bg-emerald/15 px-2 py-0.5 text-xs font-semibold text-emerald">
                    ✓ Solo-Verified
                  </span>
                )}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-night/40 hover:text-night">✕</button>
        </div>

        <p className="mt-4 text-sm text-night/80">{traveler.bio}</p>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {traveler.tags.map((t) => (
            <span key={t} className="rounded-full bg-violet/10 px-2.5 py-1 text-xs font-semibold text-violet-deep">
              {t}
            </span>
          ))}
        </div>

        <section className="mt-5">
          <h4 className="mb-2 text-sm font-bold text-night">Badges</h4>
          {badges.length ? (
            <div className="flex flex-wrap gap-2">
              {badges.map((b) => (
                <span key={b.id} className="flex items-center gap-1 rounded-lg bg-night/5 px-2 py-1 text-xs text-night/80">
                  {b.emoji} {b.name}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-xs text-night/50">No badges yet — just getting started.</p>
          )}
        </section>

        <section className="mt-5">
          <h4 className="mb-2 text-sm font-bold text-night">Visited provinces</h4>
          <TurkeyMiniMap visited={traveler.visitedProvinces} />
        </section>

        <div className="mt-6 flex gap-2">
          <button
            onClick={onConnect}
            disabled={connected}
            className={`flex-1 rounded-xl py-3 text-sm font-semibold ${
              connected ? 'bg-emerald/20 text-emerald' : 'btn-accent'
            }`}
          >
            {connected ? '✓ Connected' : '👋 Connect'}
          </button>
          <button className="flex-1 rounded-xl border-2 border-night/15 py-3 text-sm font-semibold text-night hover:border-night/30">
            💬 Message
          </button>
        </div>
      </div>
    </div>
  );
}
