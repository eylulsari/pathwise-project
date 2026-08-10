/**
 * Translation parity check: every key must exist in BOTH `en` and `tr`.
 *
 * `t()` falls back to English and then to the raw key, so a missing Turkish
 * string never crashes — it just quietly ships English (or, worse, a key like
 * `social.matchLabel`) into the UI. That is exactly the kind of thing nobody
 * notices until a demo. This makes it a build-time failure instead.
 *
 * Run: npm run i18n:check
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const file = resolve(here, '../src/i18n/translations.ts');

// The dictionaries are plain object literals; strip the TypeScript-only bits
// so they can be imported as JavaScript without adding a build step.
const source = readFileSync(file, 'utf8')
  .replace(/export type Lang[^\n]*\n/g, '')
  .replace(/export const translations[^=]*=/, 'const translations =')
  .replace(/\bas const\b/g, '')
  .replace(/: Record<[^>]*>/g, '');

const { default: translations } = await import(
  'data:text/javascript,' +
    encodeURIComponent(source + '\nexport default translations;')
);

const flatten = (obj, prefix = '') =>
  Object.entries(obj).flatMap(([key, value]) =>
    value && typeof value === 'object'
      ? flatten(value, `${prefix}${key}.`)
      : [`${prefix}${key}`],
  );

const en = new Set(flatten(translations.en));
const tr = new Set(flatten(translations.tr));
const missingInTr = [...en].filter((k) => !tr.has(k));
const missingInEn = [...tr].filter((k) => !en.has(k));

if (missingInTr.length || missingInEn.length) {
  if (missingInTr.length) console.error('Missing in tr:', missingInTr.join(', '));
  if (missingInEn.length) console.error('Missing in en:', missingInEn.join(', '));
  process.exit(1);
}

console.log(`i18n OK — ${en.size} keys present in both en and tr.`);
