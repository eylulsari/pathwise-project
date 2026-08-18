/**
 * Emits TypeScript `Place` records for batch 2 and appends them to the dataset.
 *
 * Only places with a **verified** coordinate are emitted. A place the geocoder
 * could not resolve, or whose hit the district check rejected, is skipped and
 * listed — the dataset never receives a coordinate nobody sourced.
 *
 * Usage: node scripts/emit-batch2-records.mjs [--dry-run]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const INPUT = resolve(here, 'data/pathwise-places-batch2.normalised.json');
const GEOCODED = resolve(here, 'data/geocoded.json');
const DATASET = resolve(
  here,
  '../pathwise-backend/src/modules/places/infrastructure/persistence/place.dataset.ts',
);

const dryRun = process.argv.includes('--dry-run');

/** placeId prefix per hub, matching the ids already in the dataset. */
const ID_PREFIX = {
  sultanahmet: 'sultanahmet',
  'eminonu-sirkeci': 'eminonu',
  'beyoglu-taksim': 'beyoglu',
  'karakoy-galata': 'galata',
  'besiktas-bogaz': 'besiktas',
  'ortakoy-bebek': 'ortakoy',
  'balat-fener': 'balat',
  'kadikoy-moda': 'kadikoy',
  uskudar: 'uskudar',
  adalar: 'adalar',
  eyupsultan: 'eyup',
  sariyer: 'sariyer',
  'nisantasi-sisli': 'nisantasi',
  'beykoz-anadolu-kavagi': 'beykoz',
  'zeytinburnu-bakirkoy': 'zeytinburnu',
};

const FOLD = { ı: 'i', ş: 's', ğ: 'g', ü: 'u', ö: 'o', ç: 'c', â: 'a', î: 'i', û: 'u' };
const slug = (s) =>
  s
    .toLocaleLowerCase('tr')
    .replace(/[ışğüöçâîû]/g, (c) => FOLD[c] ?? c)
    .replace(/[^a-z0-9]/g, '');

const { places } = JSON.parse(readFileSync(INPUT, 'utf8'));
const geocoded = JSON.parse(readFileSync(GEOCODED, 'utf8'));
delete geocoded._failures;

const source = readFileSync(DATASET, 'utf8');
const existingIds = new Set([...source.matchAll(/placeId: '([^']+)'/g)].map((m) => m[1]));

const q = (s) => `'${String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
const skipped = [];
const emitted = [];
const usedIds = new Set(existingIds);

for (const place of places) {
  const hit = geocoded[place.name];
  if (!hit) {
    skipped.push(`${place.hub.padEnd(22)} ${place.name}`);
    continue;
  }

  let id = `ChIJ-${ID_PREFIX[place.hub] ?? place.hub}-${slug(place.name)}`.slice(0, 64);
  if (usedIds.has(id)) id = `${id}2`;
  usedIds.add(id);

  // `category` is the record's primary Interest; `placeType` is what it
  // physically is. The drop calls the latter "category", so they cross over.
  const category = place.interests[0] ?? 'culture';
  const paid = place.entryFeeTry > 0;

  emitted.push(`  {
    placeId: ${q(id)},
    name: ${q(place.name)},
    hub: ${q(place.hub)},
    lat: ${hit.lat},
    lng: ${hit.lng},
    rating: null,
    reviewCount: 0,
    category: ${q(category)},
    interests: [${place.interests.map(q).join(', ')}],
    entryFeeTry: ${place.entryFeeTry},${paid ? '\n    entryFeeApprox: true,' : ''}
    avgFoodCostTry: ${place.avgFoodCostTry},
    avgVisitMinutes: ${place.avgVisitMinutes},
    openingHours: 'Hours not verified',
    isIndoor: ${place.isIndoor},
    isSunsetSpot: ${place.isSunsetSpot},
    museumPass: false,
    localTip: '',
    // extended attributes
    placeType: ${q(place.category)},
    source: 'Curated (estimated)',
  },`);
}

console.log(`emitted : ${emitted.length}`);
console.log(`skipped : ${skipped.length} (no verified coordinate)`);
for (const s of skipped) console.log(`   - ${s}`);

if (dryRun) {
  console.log('\n--dry-run: nothing written.');
} else {
  const closing = source.lastIndexOf('];');
  if (closing === -1) throw new Error('could not find the end of PLACE_DATASET');
  const updated = source.slice(0, closing) + emitted.join('\n') + '\n' + source.slice(closing);
  writeFileSync(DATASET, updated);
  console.log(`\nappended ${emitted.length} records to place.dataset.ts`);
}
