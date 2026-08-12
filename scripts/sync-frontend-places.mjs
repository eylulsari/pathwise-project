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
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const BACKEND = resolve(root, 'pathwise-backend/src/modules/places/infrastructure/persistence');
const TARGET = resolve(root, 'pathwise/src/hubData.ts');

/**
 * Loads a TypeScript data module as plain data by stripping the type-only
 * syntax. The datasets are object literals with no logic, so this needs no
 * build step — the same technique `pathwise/scripts/check-i18n.mjs` already
 * uses for the translation dictionaries.
 */
async function loadDataModule(file, exportNames) {
  const source = readFileSync(file, 'utf8')
    .replace(/^import[^\n]*\n/gm, '')
    .replace(/:\s*(Place|HubMeta)\[\]/g, '')
    .replace(/:\s*\{[^}]*\}\[\]/g, '');
  return import('data:text/javascript,' + encodeURIComponent(source));
}

const { PLACE_DATASET } = await loadDataModule(resolve(BACKEND, 'place.dataset.ts'));
const { HUB_DATASET, TRANSIT_HUBS } = await loadDataModule(resolve(BACKEND, 'hub.dataset.ts'));

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

const check = process.argv.includes('--check');
const current = readFileSync(TARGET, 'utf8');

if (check) {
  if (current === output) {
    console.log(`✓ ${TARGET} is up to date (${PLACE_DATASET.length} places, ${HUB_DATASET.length} hubs)`);
    process.exit(0);
  }
  console.error(
    `✗ pathwise/src/hubData.ts is STALE.\n\n` +
      `  The backend place/hub datasets changed but the generated frontend copy\n` +
      `  was not regenerated. Run:\n\n` +
      `      node scripts/sync-frontend-places.mjs\n\n` +
      `  and commit the result.\n`,
  );
  process.exit(1);
}

writeFileSync(TARGET, output);
console.log(`wrote ${TARGET} — ${PLACE_DATASET.length} places, ${HUB_DATASET.length} hubs`);
