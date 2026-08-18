import type { ReactNode } from 'react';

/**
 * A deliberately small Markdown renderer.
 *
 * ── Why not a library, and why not innerHTML ─────────────────────────
 * The posts are three files in this repo written by us, and they use six
 * constructs between them. A parser that produces an HTML *string* would have
 * to be paired with `dangerouslySetInnerHTML`, which is a standing invitation
 * for the day someone renders text that did not come from the repo. This one
 * produces React elements instead, so anything it does not recognise ends up
 * as text — escaping is React's job and it cannot be skipped.
 *
 * Supported, and nothing else: `##`/`###` headings, paragraphs, `-` and `1.`
 * lists, `>` blockquotes, `**bold**`, `*italic*` and `[text](url)`.
 * Unsupported syntax renders verbatim rather than silently disappearing —
 * a stray `~~word~~` should look wrong in review, not vanish.
 */

export interface Frontmatter {
  [key: string]: string;
}

export interface ParsedDocument {
  meta: Frontmatter;
  body: string;
}

/**
 * Split a leading `---` block off the top of a file.
 *
 * Values are taken literally to the end of the line — no quoting, no nesting,
 * no YAML. Post titles contain colons, so only the *first* colon splits.
 */
export function parseFrontmatter(raw: string): ParsedDocument {
  // Strip a byte-order mark by escape, not by pasting the character — an
  // invisible literal in a regex is unreviewable.
  const text = raw.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
  const match = /^---\n([\s\S]*?)\n---\n?/.exec(text);
  if (!match) return { meta: {}, body: text.trim() };

  const meta: Frontmatter = {};
  for (const line of match[1].split('\n')) {
    const at = line.indexOf(':');
    if (at === -1) continue;
    meta[line.slice(0, at).trim()] = line.slice(at + 1).trim();
  }
  return { meta, body: text.slice(match[0].length).trim() };
}

/** `**bold**`, `*italic*` and `[text](url)`, in one pass over the line. */
function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const out: ReactNode[] = [];
  // One alternation so the three cannot fight over the same characters.
  const pattern = /\*\*([^*]+)\*\*|\*([^*]+)\*|\[([^\]]+)\]\(([^)\s]+)\)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;

  while ((m = pattern.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const key = `${keyPrefix}-i${i++}`;
    if (m[1] !== undefined) {
      out.push(<strong key={key} className="font-semibold text-ink">{m[1]}</strong>);
    } else if (m[2] !== undefined) {
      out.push(<em key={key}>{m[2]}</em>);
    } else {
      const href = m[4];
      // Only in-app and http(s) links. `javascript:` and friends are rendered
      // as the text they are rather than followed.
      const safe = /^(https?:\/\/|\/)/.test(href);
      out.push(
        safe ? (
          <a
            key={key}
            href={href}
            className="font-semibold text-iznik underline underline-offset-2 hover:text-terracotta"
            {...(href.startsWith('/') ? {} : { target: '_blank', rel: 'noopener noreferrer' })}
          >
            {m[3]}
          </a>
        ) : (
          `[${m[3]}](${href})`
        ),
      );
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

/** Markdown → React elements. Block-level parsing is line-based. */
export function renderMarkdown(body: string): ReactNode[] {
  const lines = body.replace(/\r\n/g, '\n').split('\n');
  const out: ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (!line.trim()) {
      i++;
      continue;
    }

    const heading = /^(#{2,3})\s+(.*)$/.exec(line);
    if (heading) {
      const text = renderInline(heading[2], `h${key}`);
      out.push(
        heading[1].length === 2 ? (
          <h2 key={key++} className="mt-8 font-display text-xl font-bold text-ink first:mt-0">
            {text}
          </h2>
        ) : (
          <h3 key={key++} className="mt-6 font-display text-base font-bold text-ink">
            {text}
          </h3>
        ),
      );
      i++;
      continue;
    }

    if (/^>\s?/.test(line)) {
      const quoted: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) {
        quoted.push(lines[i].replace(/^>\s?/, ''));
        i++;
      }
      out.push(
        <blockquote
          key={key++}
          className="mt-4 border-l-4 border-iznik/30 bg-iznik/5 py-2 pl-4 text-sm italic leading-relaxed text-ink/75"
        >
          {renderInline(quoted.join(' '), `q${key}`)}
        </blockquote>,
      );
      continue;
    }

    const ordered = /^\d+\.\s+/.test(line);
    if (ordered || /^[-*]\s+/.test(line)) {
      const items: string[] = [];
      const matches = (l: string) => (ordered ? /^\d+\.\s+/.test(l) : /^[-*]\s+/.test(l));
      while (i < lines.length && matches(lines[i])) {
        items.push(lines[i].replace(ordered ? /^\d+\.\s+/ : /^[-*]\s+/, ''));
        i++;
      }
      const li = items.map((item, n) => (
        <li key={n} className="leading-relaxed">
          {renderInline(item, `l${key}-${n}`)}
        </li>
      ));
      out.push(
        ordered ? (
          <ol key={key++} className="mt-4 list-decimal space-y-2 pl-5 text-sm text-ink/80 marker:font-semibold marker:text-iznik">
            {li}
          </ol>
        ) : (
          <ul key={key++} className="mt-4 list-disc space-y-2 pl-5 text-sm text-ink/80 marker:text-iznik">
            {li}
          </ul>
        ),
      );
      continue;
    }

    // Anything else is a paragraph: consecutive non-blank lines that do not
    // start another block, joined with a space the way Markdown does.
    const para: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^(#{2,3}\s|>|[-*]\s|\d+\.\s)/.test(lines[i])
    ) {
      para.push(lines[i].trim());
      i++;
    }
    out.push(
      <p key={key++} className="mt-4 text-sm leading-relaxed text-ink/80">
        {renderInline(para.join(' '), `p${key}`)}
      </p>,
    );
  }

  return out;
}
