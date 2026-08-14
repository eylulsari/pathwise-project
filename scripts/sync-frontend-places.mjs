/**
 * Generates `pathwise/src/hubData.ts` from the backend place and hub datasets.
 *
 * WHY THIS EXISTS
 * The two halves of the app used to keep independent hand-maintained copies of
 * the same data, and they silently drifted: the backend planned routes over 28
 * places while the frontend map and bucket list drew from 41, with 13 places
 * that existed on one side only. Nothing detected it, because nothing compared
 * them. The backend dataset is now the single source of truth and this file is
 * a build artifact derived from it.
 *
 * WHY A GENERATED FILE RATHER THAN A RUNTIME FETCH
 * Four components look places up synchronously by id (`PLACES_BY_ID`). Making
 * that async would mean rewriting component flow and loading states purely to
 * change where data comes from — and rewriting the e2e suite along with it. A
 * generated file closes the divergence with no behaviour change at all.
 *
 * The frontend needs far less than the full record: id, name, hub, coordinates
 * and the ticket price. Emitting a projection instead of the whole `Place`
 * keeps roughly 120 KB of prose (insider tips, transit notes) out of the JS
 * bundle — none of it is rendered from this file anyway, since itinerary stops
 * carry their own full `Place` objects straight from the API.
 *
 * Usage:
 *   node scripts/sync-frontend-places.mjs           # write the artifact
 *   node scripts/sync-frontend-places.mjs --check   # fail if it is stale (CI)
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const BACKEND = resolve(root, 'pathwise-backend/src/modules/places/infrastructure/persistence');
const SOCIAL = resolve(root, 'pathwise-backend/src/modules/social/infrastructure/persistence');
const TARGET = resolve(root, 'pathwise/src/hubData.ts');
const TRAVELER_TARGET = resolve(root, 'pathwise/src/travelerData.ts');

/**
 * Loads a TypeScript data module as plain data by stripping the type-only
 * syntax. The datasets are object literals with no logic, so this needs no
 * build step — the same technique `pathwise/scripts/check-i18n.mjs` already
 * uses for the translation dictionaries.
 *
 * The strip list grows with the datasets. `Record<…>` annotations and casts
 * arrived with `HUB_SIDE`, and until they were handled this loader failed with
 * a bare `SyntaxError` naming a line rather than the missing rule — worth
 * remembering before adding a type shape it has never seen.
 */
async function loadDataModule(file) {
  const source = readFileSync(file, 'utf8')
    .replace(/^import[^\n]*\n/gm, '')
    .replace(/:\s*(Place|HubMeta|Traveler)\[\]/g, '')
    .replace(/:\s*\{[^}]*\}\[\]/g, '')
    .replace(/:\s*Record<[^>]*>/g, '')
    .replace(/\bas\s+Record<[^>]*>/g, '');
  return import('data:text/javascript,' + encodeURIComponent(source));
}

const { PLACE_DATASET } = await loadDataModule(resolve(BACKEND, 'place.dataset.ts'));
const { HUB_DATASET, TRANSIT_HUBS } = await loadDataModule(resolve(BACKEND, 'hub.dataset.ts'));
const { TRAVELER_SEED } = await loadDataModule(resolve(SOCIAL, 'traveler.dataset.ts'));

// ── Emit ────────────────────────────────────────────────────────────────
const q = (s) => `'${String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;

const hubLines = HUB_DATASET.map(
  (h) =>
    `  { id: ${q(h.id)}, name: ${q(h.name)}, side: ${q(h.side)}, ` +
    `blurb: ${q(h.blurb)}, center: [${h.center[0]}, ${h.center[1]}], accent: ${q(h.accent)} },`,
).join('\n');

const transitLines = TRANSIT_HUBS.map(
  (t) => `  { label: ${q(t.label)}, lat: ${t.lat}, lng: ${t.lng} },`,
).join('\n');

// Grouped by hub, in hub order, so a human reading the artifact can still find
// things — a flat 133-line block would be unreadable in review.
const placeLines = HUB_DATASET.flatMap((hub) => {
  const inHub = PLACE_DATASET.filter((p) => p.hub === hub.id);
  return [
    `  // ── ${hub.name} (${inHub.length}) ──`,
    ...inHub.map(
      (p) =>
        `  { placeId: ${q(p.placeId)}, name: ${q(p.name)}, hub: ${q(p.hub)}, ` +
        `lat: ${p.lat}, lng: ${p.lng}, entryFeeTry: ${p.entryFeeTry}` +
        (p.entryFeeApprox ? `, entryFeeApprox: true` : '') +
        ` },`,
    ),
  ];
}).join('\n');

const orphans = PLACE_DATASET.filter((p) => !HUB_DATASET.some((h) => h.id === p.hub));
if (orphans.length) {
  throw new Error(
    `places reference a hub that is not in HUB_DATASET: ${orphans.map((p) => `${p.placeId} (${p.hub})`).join(', ')}`,
  );
}

const output = `// ─────────────────────────────────────────────────────────────────────────
// GENERATED FILE — DO NOT EDIT BY HAND.
//
// Produced from the backend datasets by \`node scripts/sync-frontend-places.mjs\`:
//   pathwise-backend/src/modules/places/infrastructure/persistence/place.dataset.ts
//   pathwise-backend/src/modules/places/infrastructure/persistence/hub.dataset.ts
//
// The backend is the single source of truth for places and hubs. Edit the
// datasets there and re-run the script; CI runs it with --check and fails if
// this file is stale, so the two halves cannot drift apart again.
//
// \`PLACES\` here is a deliberate PROJECTION, not the full \`Place\` record —
// only the fields the synchronous \`PLACES_BY_ID\` lookups actually read. Full
// place objects reach the UI on itinerary stops, straight from the API.
// ─────────────────────────────────────────────────────────────────────────
import type { HubMeta, PlaceSummary } from './types';

export const HUBS: HubMeta[] = [
${hubLines}
];

export const HUB_BY_ID: Record<string, HubMeta> = Object.fromEntries(
  HUBS.map((h) => [h.id, h]),
);

// Transit hubs / ferry piers for the start-point selector (IBB Open Data).
export const TRANSIT_HUBS: { label: string; lat: number; lng: number }[] = [
${transitLines}
];

export const PLACES: PlaceSummary[] = [
${placeLines}
];

export const PLACES_BY_ID: Record<string, PlaceSummary> = Object.fromEntries(
  PLACES.map((p) => [p.placeId, p]),
);
`;

// ── Travelers ───────────────────────────────────────────────────────────
// The frontend keeps a copy purely as an offline fallback: when the backend is
// unreachable, `api.getTravelers` renders this list so the Social page is not
// blank. It was hand-maintained and had already fallen behind — the same drift
// that left places 13 apart, just somewhere nobody looks.
const travelerLines = TRAVELER_SEED.map((t) => {
  const field = (key, value) =>
    value === undefined ? null : `${key}: ${typeof value === 'string' ? q(value) : Array.isArray(value) ? `[${value.map(q).join(', ')}]` : value}`;
  return (
    '  { ' +
    [
      field('id', t.id),
      field('name', t.name),
      field('age', t.age),
      field('nationality', t.nationality),
      field('avatarColor', t.avatarColor),
      field('tags', t.tags),
      field('bio', t.bio),
      field('soloVerified', t.soloVerified),
      field('visitedProvinces', t.visitedProvinces),
      field('badges', t.badges),
      field('preferredHubs', t.preferredHubs),
      field('budgetLevel', t.budgetLevel),
      field('identifiesAsWoman', t.identifiesAsWoman),
    ]
      .filter(Boolean)
      .join(', ') +
    ' },'
  );
}).join('\n');

const travelerOutput = `// ─────────────────────────────────────────────────────────────────────────
// GENERATED FILE — DO NOT EDIT BY HAND.
//
// Produced from the backend traveler seed by
// \`node scripts/sync-frontend-places.mjs\`:
//   pathwise-backend/src/modules/social/infrastructure/persistence/traveler.dataset.ts
//
// This list is ONLY the offline fallback for \`api.getTravelers\` — the Social
// page normally renders whatever GET /api/social/travelers returns. It exists
// so that a backend outage shows a populated page instead of a blank one, and
// it is generated so that fallback cannot quietly describe a different world
// from the live one.
//
// \`visibleToWomenOnly\` is deliberately NOT carried over: it is a server-side
// visibility rule the offline path has no way to enforce reciprocally, and a
// client that filtered on it would be guessing at a privacy decision.
//
// ⚠️ \`identifiesAsWoman\` is DEMO SEED DATA, hand-assigned in the backend seed.
// It is NOT inferred from names, avatars or any other attribute — this product
// never guesses gender. In production the value only ever comes from the
// account holder ticking the opt-in box themselves, and it is never verified.
// ─────────────────────────────────────────────────────────────────────────
import type { Traveler } from './types';

export const TRAVELERS: Traveler[] = [
${travelerLines}
];
`;

// ── Write / check ───────────────────────────────────────────────────────
const artifacts = [
  { path: TARGET, label: 'pathwise/src/hubData.ts', content: output },
  { path: TRAVELER_TARGET, label: 'pathwise/src/travelerData.ts', content: travelerOutput },
];

const check = process.argv.includes('--check');

if (check) {
  const stale = artifacts.filter(
    (a) => !existsSync(a.path) || readFileSync(a.path, 'utf8') !== a.content,
  );
  if (stale.length === 0) {
    console.log(
      `✓ generated files are up to date ` +
        `(${PLACE_DATASET.length} places, ${HUB_DATASET.length} hubs, ${TRAVELER_SEED.length} travelers)`,
    );
    process.exit(0);
  }
  console.error(
    `✗ ${stale.length === 1 ? 'A generated file is' : 'Generated files are'} STALE:\n` +
      stale.map((a) => `      ${a.label}`).join('\n') +
      `\n\n  The backend datasets changed but the generated frontend copies were\n` +
      `  not regenerated. Run:\n\n` +
      `      node scripts/sync-frontend-places.mjs\n\n` +
      `  and commit the result.\n`,
  );
  process.exit(1);
}

for (const a of artifacts) writeFileSync(a.path, a.content);
console.log(
  `wrote ${artifacts.length} files — ${PLACE_DATASET.length} places, ` +
    `${HUB_DATASET.length} hubs, ${TRAVELER_SEED.length} travelers`,
);
