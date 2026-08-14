/**
 * Seeds real opening hours from OpenStreetMap into the place dataset.
 *
 * WHY THIS IS A SEEDING PASS AND NOT THE RUNTIME ENRICHMENT
 * `EnrichmentService` already fetches OSM tags per place, on demand, for the
 * detail panel. That is the wrong shape for hours: the route engine and
 * Today's Path show `place.openingHours` while *planning a day*, so it has to
 * be on the record, not a request away. 83 of the 124 places currently say
 * "Hours not verified", which is honest but useless to someone deciding
 * whether they can get in.
 *
 * Data comes from OSM's `opening_hours` tag (ODbL). Whatever it writes is
 * marked `openingHoursSource: 'OpenStreetMap'` so the UI can attribute it, and
 * anything OSM does not know is left alone rather than guessed at.
 *
 * Usage:
 *   node scripts/seed-opening-hours.mjs             # write into place.dataset.ts
 *   node scripts/seed-opening-hours.mjs --dry-run   # report only
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as sleep } from 'node:timers/promises';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const DATASET = resolve(
  root,
  'pathwise-backend/src/modules/places/infrastructure/persistence/place.dataset.ts',
);
const CACHE = resolve(here, 'data/osm-hours.json');

/**
 * Overpass mirrors, tried in turn.
 *
 * The first full run lost 42 of 83 places to HTTP 504 — not a rejection, just
 * the main instance being busy, and three linear retries against the *same*
 * host all landed inside the same busy window. Rotating hosts is what actually
 * breaks out of that: the mirrors are independent deployments of the same
 * database, so a timeout on one says nothing about the next.
 */
const OVERPASS_URLS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
];
const USER_AGENT = 'Pathwise/1.0 (Istanbul travel planner; one-off hours seeding)';
// Overpass asks for well under 1 req/s sustained; this is a one-off batch job.
const REQUEST_INTERVAL_MS = 3000;
const MAX_RETRIES = 6;
/**
 * Radius around the curated coordinate, in metres. Tight on purpose — see the
 * name guard below for why proximity alone is not nearly enough.
 */
const SEARCH_RADIUS_M = 40;

// ── Name matching ───────────────────────────────────────────────────────
/**
 * Proximity alone attaches the WRONG hours, and confidently.
 *
 * The first run of this script gave "Soğukçeşme Sokağı" — a street — Hagia
 * Sophia's 09:00–19:30, because Hagia Sophia is the most prominent tagged
 * feature within 60 m of it. It gave "Binbirdirek Sarnıcı" the office hours of
 * a district education directorate next door. Both looked completely plausible
 * on screen, and both would have sent someone to a closed door.
 *
 * So a hit is only accepted when the OSM feature's name actually corresponds to
 * the place we asked about. That trades coverage for trust, which is the right
 * way round: "Hours not verified" is a worse experience than real hours, but a
 * far better one than the neighbour's hours presented as fact.
 */
const FOLD = { ı: 'i', i̇: 'i', ş: 's', ğ: 'g', ü: 'u', ö: 'o', ç: 'c', â: 'a', î: 'i', û: 'u' };
const normalise = (s) =>
  s
    .toLocaleLowerCase('tr')
    .replace(/[ışğüöçâîû]/g, (c) => FOLD[c] ?? c)
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/** Words too generic to count as evidence that two names are the same place. */
const STOPWORDS = new Set([
  'camii', 'cami', 'mosque', 'muzesi', 'muze', 'museum', 'parki', 'park',
  'carsisi', 'carsi', 'bazaar', 'market', 'sokagi', 'sokak', 'street',
  'caddesi', 'cadde', 'meydani', 'square', 'sarayi', 'palace', 'kilisesi',
  'church', 'iskelesi', 'pier', 'sahili', 'tepesi', 'kulesi', 'tower',
  'istanbul', 'buyuk', 'kucuk', 'tarihi', 'the', 've', 'and',
  // Districts and neighbourhoods. Every record in a hub carries its hub's
  // name, so sharing one proves nothing: "Bebek Badem Ezmesi" (an almond-paste
  // shop) matched "Bebek Balıkçı" (a fish restaurant) on the word "bebek"
  // alone, and since both are food the kind check waved it through. The
  // shop was given the restaurant's midnight closing time.
  'sultanahmet', 'eminonu', 'sirkeci', 'beyoglu', 'taksim', 'karakoy',
  'galata', 'besiktas', 'ortakoy', 'bebek', 'balat', 'fener', 'kadikoy',
  'moda', 'uskudar', 'adalar', 'buyukada', 'heybeliada', 'kuzguncuk',
]);

const tokens = (s) =>
  new Set(normalise(s).split(' ').filter((w) => w.length > 2 && !STOPWORDS.has(w)));

/**
 * True when the OSM feature is plausibly the same place. Requires at least one
 * shared distinctive word — "Ayasofya" vs "Sogukcesme" share none, which is
 * exactly the case that has to be rejected.
 */
/**
 * Whether an OSM feature is the *kind of thing* our record describes.
 *
 * A name match is still not enough. "Binbirdirek Sarnıcı" (an underground
 * cistern) sits next to "Binbirdirek Parkı", which shares its distinctive word
 * and is tagged `leisure=park` — open 24 hours. Attaching that to the cistern
 * would tell a traveller they can walk in at midnight.
 *
 * Some of our place types have no meaningful opening hours at all: a street, a
 * viewpoint, a shoreline, a boat tour. For those, ANY hours found nearby belong
 * to something else by definition, so they are refused outright.
 */
const OSM_KIND_FOR = {
  museum: (t) => t.tourism === 'museum' || Boolean(t.historic),
  mosque: (t) => t.amenity === 'place_of_worship',
  church: (t) => t.amenity === 'place_of_worship',
  landmark: (t) =>
    Boolean(t.historic) ||
    t.tourism === 'attraction' ||
    t.amenity === 'place_of_worship' ||
    Boolean(t.man_made),
  food: (t) =>
    ['restaurant', 'cafe', 'fast_food', 'bar', 'pub', 'ice_cream'].includes(t.amenity) ||
    ['bakery', 'confectionery', 'pastry', 'deli', 'coffee'].includes(t.shop),
  market: (t) => Boolean(t.shop) || t.amenity === 'marketplace',
  park: (t) => ['park', 'garden'].includes(t.leisure),
  // No opening hours of their own — anything nearby is a different object.
  street: () => false,
  viewpoint: () => false,
  beach: () => false,
  experience: () => false,
};

function kindMatches(placeType, tags) {
  const predicate = OSM_KIND_FOR[placeType];
  // Unknown/absent placeType: fall back to requiring the name match alone.
  return predicate ? predicate(tags) : true;
}

function namesMatch(ours, osm) {
  if (!osm) return false;
  const a = tokens(ours);
  const b = tokens(osm);
  if (a.size === 0 || b.size === 0) return false;
  for (const w of a) if (b.has(w)) return true;
  // Fall back to substring containment for single-word names like "Kapalıçarşı".
  const na = normalise(ours).replace(/\s/g, '');
  const nb = normalise(osm).replace(/\s/g, '');
  return na.length > 5 && nb.length > 5 && (na.includes(nb) || nb.includes(na));
}

const dryRun = process.argv.includes('--dry-run');

/**
 * Turns an OSM `opening_hours` expression into something a traveller can read.
 * Deliberately conservative: anything with syntax we do not confidently
 * understand is returned as-is rather than mistranslated, because a wrong
 * closing time is worse than an unfamiliar one.
 */
function humanise(raw) {
  const v = raw.trim();
  if (/^24\/7$/i.test(v)) return 'Open 24 hours';
  // "Mo-Su 09:00-19:00" → "Daily 09:00–19:00"
  const daily = v.match(/^Mo-Su\s+(\d{2}:\d{2})-(\d{2}:\d{2})$/);
  if (daily) return `Daily ${daily[1]}–${daily[2]}`;
  const simple = v.match(/^([A-Za-z-]+)\s+(\d{2}:\d{2})-(\d{2}:\d{2})$/);
  if (simple) return `${simple[1]} ${simple[2]}–${simple[3]}`;
  return v;
}

/** Exponential backoff with jitter: ~6s, 12s, 24s, 48s, 96s, capped at 2 min. */
function backoffMs(attempt) {
  const base = Math.min(REQUEST_INTERVAL_MS * 2 ** attempt, 120000);
  return base + Math.random() * 2000;
}

async function fetchHours(place) {
  const query =
    `[out:json][timeout:25];` +
    `nwr(around:${SEARCH_RADIUS_M},${place.lat},${place.lng})["opening_hours"]["name"];` +
    `out tags 20;`;

  // Overpass rate-limits (429) and times out (504) under load. Both are
  // transient, so retry — but move to a different mirror each time and back off
  // exponentially with jitter, rather than knocking on the same busy door at a
  // fixed interval. A whole batch of clients retrying in lockstep is how the
  // busy window gets extended instead of ridden out.
  let body;
  let lastStatus = 0;
  for (let attempt = 1; ; attempt++) {
    const url = OVERPASS_URLS[(attempt - 1) % OVERPASS_URLS.length];
    let res;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': USER_AGENT,
        },
        body: `data=${encodeURIComponent(query)}`,
        signal: AbortSignal.timeout(60000),
      });
    } catch (err) {
      // A mirror that is down or hangs past the timeout is the same situation
      // as a 504 — try the next one rather than losing the place.
      if (attempt > MAX_RETRIES) throw err;
      await sleep(backoffMs(attempt));
      continue;
    }
    if (res.ok) {
      body = await res.json();
      break;
    }
    lastStatus = res.status;
    if ((res.status === 429 || res.status === 504) && attempt <= MAX_RETRIES) {
      await sleep(backoffMs(attempt));
      continue;
    }
    throw new Error(`Overpass responded ${lastStatus}`);
  }

  const tagged = (body.elements ?? [])
    .map((e) => e.tags ?? {})
    .filter((t) => t.opening_hours && t.name);
  if (tagged.length === 0) return null;

  // Both guards are REQUIREMENTS, not tiebreaks: proximity alone hands a street
  // its famous neighbour's hours, and a name match alone hands a cistern the
  // hours of the park next to it.
  const named = tagged.filter(
    (t) => namesMatch(place.name, t.name) && kindMatches(place.placeType, t),
  );
  if (named.length === 0) {
    return { rejected: tagged.slice(0, 2).map((t) => t.name) };
  }

  const rank = (t) =>
    (t.historic || ['attraction', 'museum', 'viewpoint'].includes(t.tourism) ? 3 : 0) +
    (['restaurant', 'cafe', 'fast_food', 'bar'].includes(t.amenity) ? 2 : 0) +
    (t.shop ? 1 : 0);
  const best = named.sort((a, b) => rank(b) - rank(a))[0];
  return { raw: best.opening_hours, name: best.name };
}

// ── Read the dataset ────────────────────────────────────────────────────
const source = readFileSync(DATASET, 'utf8');
const records = [
  ...source.matchAll(
    /placeId: '([^']+)',\s*\n\s*name: '((?:[^'\\]|\\.)*)',\s*\n\s*hub: '([^']+)',\s*\n\s*lat: ([-\d.]+),\s*\n\s*lng: ([-\d.]+),/g,
  ),
].map((m) => {
  const start = source.indexOf(`placeId: '${m[1]}',`);
  const block = source.slice(start, source.indexOf('\n  },', start));
  return {
    placeId: m[1],
    name: m[2].replace(/\\'/g, "'"),
    hub: m[3],
    lat: Number(m[4]),
    lng: Number(m[5]),
    placeType: block.match(/placeType: '([^']+)'/)?.[1],
  };
});

if (records.length === 0) throw new Error('parsed no places out of the dataset');

const cache = existsSync(CACHE) ? JSON.parse(readFileSync(CACHE, 'utf8')) : {};

// Only places that currently have no verified hours are worth asking about.
const unverified = records.filter((r) => {
  const block = source.slice(source.indexOf(`placeId: '${r.placeId}'`));
  const hours = block.match(/openingHours: '([^']*)'/);
  return hours && hours[1] === 'Hours not verified';
});

console.log(`${records.length} places, ${unverified.length} without verified hours\n`);

let found = 0;
let missing = 0;
let rejected = 0;
let errors = 0;

for (const [i, place] of unverified.entries()) {
  const label = `[${String(i + 1).padStart(3)}/${unverified.length}] ${place.name}`;
  if (cache[place.placeId] !== undefined) {
    if (cache[place.placeId]) found++;
    else missing++;
    continue;
  }

  let hit;
  try {
    hit = await fetchHours(place);
  } catch (err) {
    errors++;
    console.log(`${label} — ERROR ${String(err)}`);
    await sleep(REQUEST_INTERVAL_MS);
    continue;
  }

  if (hit?.raw) {
    cache[place.placeId] = { hours: humanise(hit.raw), raw: hit.raw, osmName: hit.name };
    found++;
    console.log(`${label} — ${cache[place.placeId].hours}   [${hit.name}]`);
  } else if (hit?.rejected) {
    cache[place.placeId] = null;
    rejected++;
    console.log(`${label} — nearby hours belong to someone else (${hit.rejected.join(', ')}) — skipped`);
  } else {
    cache[place.placeId] = null;
    missing++;
    console.log(`${label} — no opening_hours in OSM`);
  }
  await sleep(REQUEST_INTERVAL_MS);
}

console.log('\n─────────────────────────────────────────');
console.log(`hours accepted        : ${found}`);
console.log(`OSM has no hours      : ${missing}`);
console.log(`rejected (name mismatch): ${rejected}`);
console.log(`request errors        : ${errors}`);

if (dryRun) {
  console.log('\n--dry-run: nothing written.');
} else {
  writeFileSync(CACHE, JSON.stringify(cache, null, 2) + '\n');

  // Rewrite the dataset in place: only the records we actually learned about,
  // and only their `openingHours` line plus a provenance marker.
  let updated = source;
  let written = 0;
  for (const [placeId, entry] of Object.entries(cache)) {
    if (!entry) continue;
    const anchor = `placeId: '${placeId}',`;
    const start = updated.indexOf(anchor);
    if (start === -1) continue;
    const end = updated.indexOf('\n  },', start);
    const block = updated.slice(start, end);
    if (!block.includes("openingHours: 'Hours not verified'")) continue;
    const replaced = block.replace(
      "openingHours: 'Hours not verified',",
      `openingHours: '${entry.hours.replace(/'/g, "\\'")}',\n    openingHoursSource: 'OpenStreetMap',`,
    );
    updated = updated.slice(0, start) + replaced + updated.slice(end);
    written++;
  }
  writeFileSync(DATASET, updated);
  console.log(`\nwrote ${written} opening hours into place.dataset.ts`);
}
