import { useEffect, useState } from 'react';
import type { Place, ReviewsResponse } from '../types';
import { api } from '../services/api';
import { useT } from '../i18n';

/**
 * Community reviews for a place (Phase 3): list + star form + helpful upvotes,
 * the community average next to the curated score, and a "report stale info"
 * action that feeds the existing content_reports moderation queue.
 *
 * ⚠️ That curated score is `place.rating`, and it is OURS — it is labelled
 * "Pathwise editorial" on screen and must stay that way. This comment used to
 * call it "the static Google rating", which it never was: no Google data is
 * fetched anywhere in this app, and a number we wrote presented as Google's
 * would be a fabricated rating attributed to a real company.
 */
export function ReviewsSection({ place }: { place: Place }) {
  const { t } = useT();
  const [data, setData] = useState<ReviewsResponse | null>(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [reported, setReported] = useState(false);

  const load = () => api.getReviews(place.placeId).then(setData).catch(() => {});
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [place.placeId]);

  async function submit() {
    if (comment.trim().length < 2) return;
    setBusy(true);
    try {
      const res = await api.createReview(place.placeId, rating, comment.trim());
      setData(res);
      setComment('');
    } finally {
      setBusy(false);
    }
  }

  async function helpful(id: string) {
    await api.markReviewHelpful(place.placeId, id).catch(() => {});
    load();
  }

  async function reportStale() {
    await api.reportContent('stale_info', place.placeId, 'Outdated info reported from reviews').catch(() => {});
    setReported(true);
  }

  return (
    <section className="mt-4 border-t border-ink/10 pt-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-bold text-iznik">💬 {t('reviews.title')}</h4>
        {reported ? (
          <span className="text-[10px] font-semibold text-sage">✓ {t('reviews.reported')}</span>
        ) : (
          <button onClick={reportStale} className="text-[10px] font-semibold text-ink/40 hover:text-terracotta">
            🚩 {t('reviews.stale')}
          </button>
        )}
      </div>

      {/* Ratings: curated Pathwise editorial score vs live community average.
          A null rating means nobody has scored this place — say so rather than
          printing a star, which would claim an editorial judgement we never made. */}
      <p className="mt-1 text-xs text-ink/70">
        <span className="font-semibold">{t('reviews.editorial')}:</span>{' '}
        {place.rating === null ? (
          <span className="text-ink/45">{t('reviews.notRated')}</span>
        ) : (
          `${place.rating}★`
        )}
        {data && data.count > 0 && (
          <>
            {' · '}
            <span className="font-semibold text-iznik">{t('reviews.community')}:</span> {data.average}★ ({data.count})
          </>
        )}
      </p>

      {/* Write a review */}
      <div className="mt-3 rounded-xl bg-ink/5 p-3">
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              onClick={() => setRating(n)}
              className={`text-xl ${n <= rating ? 'text-terracotta' : 'text-ink/20'}`}
              aria-label={`${n} stars`}
            >
              ★
            </button>
          ))}
        </div>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={2}
          placeholder={t('reviews.placeholder')}
          className="mt-2 w-full resize-none rounded-lg border border-ink/15 px-3 py-2 text-sm text-ink outline-none focus:border-iznik"
        />
        <button onClick={submit} disabled={busy || comment.trim().length < 2} className="btn-accent mt-2 px-4 py-1.5 text-xs disabled:opacity-40">
          {busy ? '…' : t('reviews.submit')}
        </button>
      </div>

      {/* Existing reviews */}
      <div className="mt-3 space-y-2">
        {data && data.reviews.length === 0 && (
          <p className="text-xs text-ink/50">{t('reviews.empty')}</p>
        )}
        {data?.reviews.map((r) => (
          <div key={r.id} data-testid="review" className="rounded-lg border border-ink/10 p-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-ink">{r.authorName}</span>
              <span className="text-xs text-terracotta">{'★'.repeat(r.rating)}</span>
            </div>
            <p className="mt-1 text-sm text-ink/80">{r.comment}</p>
            <button onClick={() => helpful(r.id)} className="mt-1 text-[11px] font-semibold text-iznik hover:text-terracotta">
              👍 {t('reviews.helpful')} ({r.helpfulCount})
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
