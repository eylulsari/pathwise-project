import type { RealTraveler, Traveler } from '../../types';
import { BADGES } from '../../mockData';
import { TurkeyMiniMap } from '../TurkeyMiniMap';
import { ConnectRequestButton } from './ConnectRequestButton';
import { useT } from '../../i18n';

/**
 * Traveler profile modal.
 *
 * Serves both kinds of card and ends differently for each, which is the whole
 * point: a real account gets one action — ask to connect — and a sample gets a
 * sentence saying there is nobody there. It used to end with a "Connect" and a
 * "Message" button for everyone, and the Message one had no handler at all.
 *
 * Badges and the visited-provinces map only exist on the demo profiles, so
 * those sections are absent rather than empty for a real account.
 */
export function TravelerModal({
  traveler,
  onClose,
}: {
  traveler: Traveler | RealTraveler;
  onClose: () => void;
}) {
  const { t } = useT();
  const isSample = traveler.isSample !== false;
  const badges = 'badges' in traveler ? BADGES.filter((b) => traveler.badges.includes(b.id)) : [];
  const details = [traveler.age, traveler.nationality].filter(Boolean).join(' · ');

  return (
    <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div data-testid="traveler-modal" className="card-cream max-h-[88vh] w-full max-w-lg overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div
              className="flex h-14 w-14 items-center justify-center rounded-full text-xl font-bold text-white"
              style={{ background: traveler.avatarColor }}
            >
              {traveler.name.split(' ').map((n) => n[0]).join('')}
            </div>
            <div>
              <h3 className="font-display text-xl font-bold text-ink">{traveler.name}</h3>
              <p className="text-sm text-ink/60">
                {details}
                {'soloVerified' in traveler && traveler.soloVerified && (
                  <span className="ms-2 rounded-full bg-sage/15 px-2 py-0.5 text-xs font-semibold text-sage">
                    ✓ Solo-Verified
                  </span>
                )}
                {/* (#SoloVerified is a brand tag — kept untranslated) */}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-ink/40 hover:text-ink">✕</button>
        </div>

        {isSample && (
          <p className="mt-4 rounded-xl bg-mustard/15 px-3 py-2 text-xs leading-relaxed text-ink/70">
            {t('social.sampleNote')}
          </p>
        )}

        {traveler.bio && <p className="mt-4 text-sm text-ink/80">{traveler.bio}</p>}

        <div className="mt-3 flex flex-wrap gap-1.5">
          {traveler.tags.map((tag) => (
            <span key={tag} className="rounded-full bg-iznik/10 px-2.5 py-1 text-xs font-semibold text-iznik">
              {tag}
            </span>
          ))}
        </div>

        {'badges' in traveler && (
          <section className="mt-5">
            <h4 className="mb-2 text-sm font-bold text-ink">{t('social.badges')}</h4>
            {badges.length ? (
              <div className="flex flex-wrap gap-2">
                {badges.map((b) => (
                  <span key={b.id} className="flex items-center gap-1 rounded-lg bg-ink/5 px-2 py-1 text-xs text-ink/80">
                    {b.emoji} {b.name}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xs text-ink/50">{t('social.noBadges')}</p>
            )}
          </section>
        )}

        {'visitedProvinces' in traveler && (
          <section className="mt-5">
            <h4 className="mb-2 text-sm font-bold text-ink">{t('social.visitedProvinces')}</h4>
            <TurkeyMiniMap visited={traveler.visitedProvinces} />
          </section>
        )}

        <div className="mt-6">
          {isSample ? (
            <p className="rounded-xl border border-dashed border-ink/15 px-4 py-3 text-center text-xs font-semibold text-ink/45">
              {t('social.sampleNoAction')}
            </p>
          ) : (
            <div className="text-center text-sm">
              <ConnectRequestButton userId={traveler.id} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
