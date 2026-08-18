import { Link, useParams } from 'react-router-dom';
import { AppHeader } from '../components/AppHeader';
import { findPost, listPosts, type BlogPost } from '../data/blog';
import { renderMarkdown } from '../utils/markdown';
import { useT } from '../i18n';

/**
 * The date, in the reader's language.
 *
 * `Intl` rather than a hand-written month table: the app already ships two
 * languages and would need a third table on the day it ships a third language.
 * An unparseable date renders as nothing rather than "Invalid Date".
 */
function formatDate(iso: string, lang: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(lang === 'tr' ? 'tr-TR' : 'en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function Meta({ post }: { post: BlogPost }) {
  const { t, lang } = useT();
  const date = formatDate(post.date, lang);
  const mins = post.readingMinutes > 0 ? `${post.readingMinutes} ${t('blog.minRead')}` : '';
  return (
    <p className="text-xs text-ink/45">{[date, mins].filter(Boolean).join(' · ')}</p>
  );
}

/** The index: every post, newest first. */
export default function Blog() {
  const { t, lang } = useT();
  const posts = listPosts(lang);

  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 space-y-6 p-4 md:p-6">
        <div>
          <h1 className="font-display text-2xl font-bold">{t('blog.title')}</h1>
          <p className="text-sm text-ink/60">{t('blog.subtitle')}</p>
        </div>

        <div className="space-y-3">
          {posts.map((post) => (
            <Link
              key={post.slug}
              to={`/blog/${post.slug}`}
              data-testid="blog-card"
              className="card-cream block p-5 transition-colors hover:border-iznik/40"
            >
              <Meta post={post} />
              <h2 className="mt-1 font-display text-lg font-bold text-ink">{post.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-ink/70">{post.excerpt}</p>
              <span className="mt-3 inline-block text-xs font-semibold text-iznik">
                {t('blog.readMore')} →
              </span>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}

/** One post. */
export function BlogPostPage() {
  const { t, lang } = useT();
  const { slug } = useParams<{ slug: string }>();
  const post = slug ? findPost(lang, slug) : null;

  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 p-4 md:p-6">
        <Link to="/blog" className="text-xs font-semibold text-iznik hover:text-terracotta">
          ← {t('blog.backToList')}
        </Link>

        {post ? (
          <article data-testid="blog-post" className="mt-4">
            <Meta post={post} />
            <h1 className="mt-1 font-display text-2xl font-bold leading-tight text-ink">
              {post.title}
            </h1>
            <div className="mt-6">{renderMarkdown(post.body)}</div>
          </article>
        ) : (
          // A slug that matches nothing in any language. Say so rather than
          // redirecting — a wrong link should be visible, not silently swapped
          // for the index.
          <p className="mt-8 rounded-xl border border-dashed border-ink/15 px-4 py-8 text-center text-sm text-ink/50">
            {t('blog.notFound')}
          </p>
        )}
      </main>
    </div>
  );
}
