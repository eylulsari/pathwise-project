/**
 * Translation parity check: every key in `en` must exist in EVERY language.
 *
 * `t()` falls back to English and then to the raw key, so a missing string
 * never crashes — it just quietly ships English (or, worse, a key like
 * `social.matchLabel`) into the UI. That is exactly the kind of thing nobody
 * notices until a demo, and with six languages it is the kind of thing nobody
 * notices at all. This makes it a build-time failure instead.
 *
 * Extra keys are reported too: a key that exists only in Spanish is either a
 * typo in the Spanish file or a string someone deleted from `en` and forgot
 * elsewhere, and both are worth knowing about.
 *
 * Run: npm run i18n:check
 */
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const localesDir = resolve(here, '../src/i18n/locales');

/**
 * The dictionaries are plain object literals, so the TypeScript-only bits can
 * be stripped and the rest imported as JavaScript without adding a build step.
 */
async function load(file) {
  const source = readFileSync(join(localesDir, file), 'utf8')
    .replace(/export const (\w+) =/, 'const dict =')
    .replace(/\bas const\b/g, '')
    .replace(/: Record<[^>]*>/g, '');
  const mod = await import(
    'data:text/javascript,' +
      encodeURIComponent(source + '\nexport default dict;')
  );
  return mod.default;
}

const flatten = (obj, prefix = '') =>
  Object.entries(obj).flatMap(([key, value]) =>
    value && typeof value === 'object'
      ? flatten(value, `${prefix}${key}.`)
      : [`${prefix}${key}`],
  );

const files = readdirSync(localesDir).filter((f) => f.endsWith('.ts')).sort();
if (!files.includes('en.ts')) {
  console.error('No en.ts in src/i18n/locales — nothing to check against.');
  process.exit(1);
}

const en = new Set(flatten(await load('en.ts')));
let failed = false;

for (const file of files) {
  const lang = file.replace(/\.ts$/, '');
  if (lang === 'en') continue;

  const keys = new Set(flatten(await load(file)));
  const missing = [...en].filter((k) => !keys.has(k));
  const extra = [...keys].filter((k) => !en.has(k));

  if (missing.length || extra.length) {
    failed = true;
    if (missing.length) console.error(`Missing in ${lang}:`, missing.join(', '));
    if (extra.length) console.error(`Not in en, only in ${lang}:`, extra.join(', '));
  }
}

if (failed) process.exit(1);

const langs = files.map((f) => f.replace(/\.ts$/, '')).join(', ');
console.log(`i18n OK — ${en.size} keys present in all ${files.length} languages (${langs}).`);
