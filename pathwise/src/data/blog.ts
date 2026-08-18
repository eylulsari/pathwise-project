import { parseFrontmatter } from '../utils/markdown';

/**
 * Blog posts, loaded from the Markdown files in `src/content/blog/<lang>/`.
 *
 * ── Why files and not a table ────────────────────────────────────────
 * A post changes when someone edits a file and opens a pull request, which is
 * also how it gets reviewed. A CMS would add a table, an editor, an auth model
 * and a moderation story for content that three people write.
 *
 * ── Why the slug comes from the filename ─────────────────────────────
 * The same slug has to resolve in both languages, or `/blog/x` would 404 the
 * moment someone switched language on a post. So the *filename* is the slug
 * and it is identical in `tr/` and `en/`; only the prose inside differs. That
 * is why the English files keep Turkish filenames — the URL is an identifier,
 * not a translated string.
 *
 * A post missing from one language falls back to the other rather than
 * disappearing: a reader following a shared link should get the article, in
 * whatever language it exists.
 */
export interface BlogPost {
  slug: string;
  title: string;
  excerpt: string;
  /** ISO date, as written in the frontmatter. */
  date: string;
  readingMinutes: number;
  body: string;
}

type RawModules = Record<string, string>;

// `eager` so the posts are part of the bundle: there are three of them, and a
// lazy chunk per post would be a network round trip to read an article.
const FILES = import.meta.glob('../content/blog/*/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as RawModules;

/** `../content/blog/tr/cami-ziyareti.md` → `{ lang: 'tr', slug: 'cami-ziyareti' }` */
function identify(path: string): { lang: string; slug: string } | null {
  const m = /\/blog\/([^/]+)\/([^/]+)\.md$/.exec(path);
  return m ? { lang: m[1], slug: m[2] } : null;
}

function build(): Record<string, BlogPost[]> {
  const byLang: Record<string, BlogPost[]> = {};

  for (const [path, raw] of Object.entries(FILES)) {
    const id = identify(path);
    if (!id) continue;
    const { meta, body } = parseFrontmatter(raw);
    // A post with no title is a broken file, not a post with an empty heading.
    if (!meta.title) continue;

    (byLang[id.lang] ??= []).push({
      slug: id.slug,
      title: meta.title,
      excerpt: meta.excerpt ?? '',
      date: meta.date ?? '',
      readingMinutes: Number(meta.readingMinutes) || 0,
      body,
    });
  }

  // Newest first, and stable when two posts share a date.
  for (const posts of Object.values(byLang)) {
    posts.sort((a, b) => (a.date === b.date ? a.slug.localeCompare(b.slug) : b.date.localeCompare(a.date)));
  }
  return byLang;
}

const POSTS_BY_LANG = build();

/** Every post in this language, newest first. Falls back to any language. */
export function listPosts(lang: string): BlogPost[] {
  const own = POSTS_BY_LANG[lang];
  if (own?.length) return own;
  return Object.values(POSTS_BY_LANG)[0] ?? [];
}

/**
 * One post. Tries the requested language, then any other — a shared link
 * should open the article rather than a not-found page because the reader's
 * language happens to be the one it was not written in.
 */
export function findPost(lang: string, slug: string): BlogPost | null {
  const preferred = POSTS_BY_LANG[lang]?.find((p) => p.slug === slug);
  if (preferred) return preferred;
  for (const posts of Object.values(POSTS_BY_LANG)) {
    const found = posts.find((p) => p.slug === slug);
    if (found) return found;
  }
  return null;
}
