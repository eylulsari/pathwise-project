/**
 * Nominatim seeding pass for the place expansion dataset.
 *
 * Pathwise has no geocoder at runtime and deliberately never will: the Overpass
 * enrichment client matches a POI by *proximity* to a known lat/lng, so a
 * coordinate is an input to enrichment, not an output of it. That leaves
 * exactly one gap — getting a first coordinate for a place we only know by
 * name. This script fills it once, offline, and writes the result to disk;
 * nothing in the running app ever calls Nominatim.
 *
 * Usage:
 *   node scripts/geocode-places.mjs              # geocode, write geocoded.json
 *   node scripts/geocode-places.mjs --dry-run    # resolve but write nothing
 *
 * Output: scripts/data/geocoded.json — { [name]: { lat, lng, displayName,
 * osmType, osmId } } plus a `_failures` list. Re-running reuses cached hits so
 * a partial run can be resumed without hammering the service again.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as sleep } from 'node:timers/promises';

const here = dirname(fileURLToPath(import.meta.url));
// Which dataset to geocode. Batch 2 arrived as a second file rather than an
// edit to the first, so the input is an argument with the original as default:
//   node scripts/geocode-places.mjs --input data/pathwise-places-batch2.json
const inputArg = process.argv.indexOf('--input');
const INPUT = resolve(
  here,
  inputArg === -1 ? 'data/pathwise-places.json' : process.argv[inputArg + 1],
);
const OUTPUT = resolve(here, 'data/geocoded.json');

// Nominatim's usage policy: absolute maximum of 1 request per second, and a
// User-Agent identifying the application. Violating either gets the caller
// blocked, so the delay is deliberately a touch over one second.
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const USER_AGENT = 'Pathwise/1.0 (Istanbul travel planner; one-off dataset seeding)';
const REQUEST_INTERVAL_MS = 1100;

/**
 * Istanbul bounding box, generous enough to include the Princes' Islands in
 * the south (lat ~40.86) and Sarıyer in the north. A hit outside this box is
 * almost certainly the wrong feature — Nominatim happily returns a same-named
 * street in another country — so it is reported rather than trusted.
 */
const BOUNDS = { minLat: 40.8, maxLat: 41.3, minLng: 28.5, maxLng: 29.5 };

const inBounds = (lat, lng) =>
  lat >= BOUNDS.minLat && lat <= BOUNDS.maxLat && lng >= BOUNDS.minLng && lng <= BOUNDS.maxLng;

/**
 * Hub centres, mirroring `HUBS` in pathwise/src/hubData.ts.
 *
 * The bounding box alone is not enough. Istanbul is full of repeated names —
 * "Yeni Cami" resolved to a mosque in Beykoz and "Gezi Parkı" to a park near
 * Kartal, both comfortably inside the city box and both the wrong feature. A
 * place should sit near the hub that claims it, so distance from the hub centre
 * is the check that actually catches a same-name mismatch.
 */
const HUB_CENTERS = {
  sultanahmet: [41.0086, 28.9785],
  'eminonu-sirkeci': [41.0165, 28.9705],
  'beyoglu-taksim': [41.0345, 28.9782],
  'karakoy-galata': [41.0243, 28.9748],
  besiktas: [41.0426, 29.0064],
  'ortakoy-bebek': [41.0553, 29.0335],
  balat: [41.0292, 28.9492],
  'kadikoy-moda': [40.9887, 29.027],
  uskudar: [41.0255, 29.0152],
  adalar: [40.8608, 29.1236],
  // Batch 2. Each centre is the district's own Nominatim result rather than a
  // number picked by eye — these are the anchors the plausibility check below
  // measures against, so guessing them would quietly widen the net.
  eyupsultan: [41.0478, 28.9327],
  sariyer: [41.1686, 29.0573],
  'nisantasi-sisli': [41.0638, 28.9832],
  'beykoz-anadolu-kavagi': [41.1343, 29.092],
  'zeytinburnu-bakirkoy': [40.9783, 28.8744],
};

/**
 * How far a place may sit from its hub centre before it looks wrong. Most hubs
 * are walkable and 4 km is already generous; `ortakoy-bebek` runs the length of
 * the Bosphorus up to Emirgan and `adalar` spans several islands, so both need
 * a wider allowance.
 */
const HUB_RADIUS_KM = {
  'ortakoy-bebek': 9, // runs up the Bosphorus as far as Emirgan
  adalar: 12, // spans Büyükada, Heybeliada and the ferry route between them
  uskudar: 6, // Çamlıca hill is genuinely ~4.5 km inland from the shore centre
  // The batch-2 hubs are districts, not neighbourhoods, and three of them are
  // genuinely enormous. A tight limit here would reject correct coordinates —
  // which is the expensive kind of wrong, since a rejected place gets no
  // coordinate at all rather than a bad one.
  eyupsultan: 8, // Miniatürk and the Koç museum sit down on the Golden Horn
  sariyer: 18, // Kilyos on the Black Sea and Belgrad Forest are both in it
  'nisantasi-sisli': 5,
  'beykoz-anadolu-kavagi': 14, // Anadolu Hisarı in the south to Poyrazköy north
  'zeytinburnu-bakirkoy': 12, // Yedikule in the east out to Florya in the west
};
const DEFAULT_RADIUS_KM = 4;

function haversineKm([lat1, lng1], [lat2, lng2]) {
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/** Returns a reason string when the coordinate looks wrong, else null. */
function suspicionFor(place, hit) {
  if (!inBounds(hit.lat, hit.lng)) return 'outside the Istanbul bounding box';
  const center = HUB_CENTERS[place.hub];
  if (!center) return null;
  const km = haversineKm(center, [hit.lat, hit.lng]);
  const limit = HUB_RADIUS_KM[place.hub] ?? DEFAULT_RADIUS_KM;
  return km > limit ? `${km.toFixed(1)} km from the ${place.hub} centre (limit ${limit} km)` : null;
}

const dryRun = process.argv.includes('--dry-run');

async function geocode(query) {
  const url =
    `${NOMINATIM_URL}?q=${encodeURIComponent(query)}` +
    `&format=json&limit=1&addressdetails=0` +
    // A viewbox biases results toward Istanbul. It is deliberately NOT combined
    // with `bounded=1`: as a hard filter the viewbox made Nominatim return
    // nothing at all for perfectly real places (Nuruosmaniye Camii among them).
    // Plausibility is enforced afterwards by `suspicionFor`, which is stricter
    // than a city-sized box anyway.
    `&viewbox=${BOUNDS.minLng},${BOUNDS.maxLat},${BOUNDS.maxLng},${BOUNDS.minLat}`;

  const res = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`Nominatim responded ${res.status}`);

  const [hit] = await res.json();
  if (!hit) return null;
  return {
    lat: Number(hit.lat),
    lng: Number(hit.lon),
    displayName: hit.display_name,
    osmType: hit.osm_type,
    osmId: hit.osm_id,
  };
}

/**
 * Query forms to try, best first.
 *
 * Nominatim is picky in ways that are not obvious. Appending ", Istanbul" —
 * the intuitive thing to do — makes it *fail* on many real places, because it
 * reads the comma as a structured address hint and finds no match for the pair.
 * "Kadıköy Boğa Heykeli, Istanbul" returns nothing; the bare "Boğa Heykeli"
 * lands exactly right. So the ladder tries the qualified form first (it
 * disambiguates common names) and falls back to progressively barer ones.
 */
function queryVariants(place) {
  if (place.nameQuery) return [place.nameQuery];

  const { name } = place;
  const withoutParenthetical = name.replace(/\s*\(.*?\)\s*/g, ' ').trim();
  // Names often lead with the district ("Kadıköy Boğa Heykeli"); OSM labels the
  // feature without it.
  const withoutDistrict = withoutParenthetical.split(' ').slice(1).join(' ');

  return [
    `${name}, Istanbul`,
    name,
    withoutParenthetical,
    withoutParenthetical.split(' ').length > 2 ? withoutDistrict : null,
  ].filter((q, i, all) => q && q.length > 3 && all.indexOf(q) === i);
}

/**
 * Walks the query ladder and returns the first hit that survives the
 * plausibility check. This is what rescues a name like "Yeni Cami", where the
 * top result is a real mosque 12 km away in Beykoz — the check rejects it and
 * the next variant gets a chance, instead of a wrong coordinate being cached.
 */
async function resolvePlace(place, onAttempt) {
  let rejected = null;
  for (const query of queryVariants(place)) {
    const hit = await geocode(query);
    await sleep(REQUEST_INTERVAL_MS);
    if (!hit) continue;
    const reason = suspicionFor(place, hit);
    if (!reason) return { hit: { ...hit, query }, rejected };
    rejected ??= { ...hit, query, reason };
    onAttempt?.(query, reason);
  }
  return { hit: null, rejected };
}

const { places } = JSON.parse(readFileSync(INPUT, 'utf8'));

// Resume support: keep coordinates we already resolved on an earlier run.
const cache = existsSync(OUTPUT) ? JSON.parse(readFileSync(OUTPUT, 'utf8')) : {};
delete cache._failures;

const failures = [];
const suspicious = [];
let resolved = 0;
let cached = 0;

for (const [i, place] of places.entries()) {
  const label = `[${String(i + 1).padStart(3)}/${places.length}] ${place.name}`;

  // Only reuse a cached coordinate that still passes the plausibility check —
  // an earlier run may have cached a hit before the check existed, or with a
  // looser radius.
  const cachedHit = cache[place.name];
  if (cachedHit && !suspicionFor(place, cachedHit)) {
    cached++;
    continue;
  }
  if (cachedHit) delete cache[place.name];

  let result;
  try {
    result = await resolvePlace(place);
  } catch (err) {
    failures.push({ name: place.name, hub: place.hub, reason: String(err) });
    console.log(`${label} — ERROR ${String(err)}`);
    continue;
  }

  if (!result.hit) {
    failures.push({
      name: place.name,
      hub: place.hub,
      reason: result.rejected ? `only implausible hits (${result.rejected.reason})` : 'no result',
    });
    if (result.rejected) suspicious.push({ name: place.name, hub: place.hub, ...result.rejected });
    console.log(`${label} — NOT FOUND${result.rejected ? ' (all hits implausible)' : ''}`);
  } else {
    cache[place.name] = result.hit;
    resolved++;
    console.log(`${label} — ${result.hit.lat.toFixed(5)}, ${result.hit.lng.toFixed(5)}`);
  }
}

console.log('\n─────────────────────────────────────────');
console.log(`resolved this run : ${resolved}`);
console.log(`reused from cache : ${cached}`);
console.log(`total geocoded    : ${Object.keys(cache).length} / ${places.length}`);
console.log(`failures          : ${failures.length}`);
console.log(`suspicious        : ${suspicious.length}`);

if (failures.length) {
  console.log('\nNOT RESOLVED — these need a coordinate by hand:');
  for (const f of failures) console.log(`  ${f.hub.padEnd(16)} ${f.name}  (${f.reason})`);
}

if (suspicious.length) {
  console.log('\nSUSPICIOUS — probably a same-name mismatch, verify before use:');
  for (const s of suspicious) {
    console.log(`  ${s.name}  →  ${s.lat}, ${s.lng}`);
    console.log(`      ${s.reason}`);
    if (s.displayName) console.log(`      ${s.displayName}`);
  }
}

if (dryRun) {
  console.log('\n--dry-run: nothing written.');
} else {
  writeFileSync(OUTPUT, JSON.stringify({ ...cache, _failures: failures }, null, 2) + '\n');
  console.log(`\nwrote ${OUTPUT}`);
}

// A non-zero exit makes a silent partial result impossible to mistake for success.
if (failures.length) process.exitCode = 1;
