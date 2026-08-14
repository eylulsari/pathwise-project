/**
 * Finds the Turkish Wikipedia article for each place, so the detail panel can
 * show a real, attributed description and photo instead of nothing.
 *
 * WHY GEOSEARCH AND NOT A TEXT SEARCH
 * Searching Wikipedia by name returns confident nonsense for Istanbul place
 * names — half of them are also the names of districts, streets, ferries or
 * other cities' landmarks. Wikipedia's geosearch takes a coordinate and returns
 * articles that are *about a thing at that location*, which is a far stronger
 * starting point. The name check then runs on top of it, so an article has to
 * be both in the right place AND plausibly about the right subject.
 *
 * The result is a title map only — no article text is copied into this repo.
 * `WikipediaClient` fetches the summary live at read time and the UI renders
 * the CC BY-SA attribution that comes with it.
 *
 * Usage:
 *   node scripts/seed-wikipedia-titles.mjs             # write the dataset
 *   node scripts/seed-wikipedia-titles.mjs --dry-run   # report only
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
const TARGET = resolve(
  root,
  'pathwise-backend/src/modules/places/infrastructure/enrichment/wiki-titles.dataset.ts',
);
const CACHE = resolve(here, 'data/wiki-titles.json');

const API = 'https://tr.wikipedia.org/w/api.php';
const USER_AGENT = 'Pathwise/1.0 (Istanbul travel planner; one-off wiki title seeding)';
const REQUEST_INTERVAL_MS = 1200; // 400ms drew 429s from Wikimedia
/** How close the article's own coordinate must be, in metres. */
const GEO_RADIUS_M = 250;

const dryRun = process.argv.includes('--dry-run');

// ── Name matching (same reasoning as the opening-hours seeder) ───────────
const FOLD = { ı: 'i', ş: 's', ğ: 'g', ü: 'u', ö: 'o', ç: 'c', â: 'a', î: 'i', û: 'u' };
const normalise = (s) =>
  s
    .toLocaleLowerCase('tr')
    .replace(/[ışğüöçâîû]/g, (c) => FOLD[c] ?? c)
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * Words that carry no evidence two names are the same place.
 *
 * District names matter as much as generic nouns here. "Tarihi Sultanahmet
 * Köftecisi" matched the article "Sultanahmet (İstanbul Tramvayı)" — a tram
 * stop — purely on the shared neighbourhood word, and "Hippodrome (Sultanahmet
 * Meydanı)" matched "Dikilitaş (Sultanahmet)", the obelisk standing on it.
 * Everything in a hub shares its hub's name, so it proves nothing.
 */
const STOPWORDS = new Set([
  // generic nouns
  'camii', 'cami', 'mosque', 'muzesi', 'muze', 'museum', 'parki', 'park',
  'carsisi', 'carsi', 'bazaar', 'sokagi', 'sokak', 'caddesi', 'cadde',
  'meydani', 'sarayi', 'palace', 'kilisesi', 'church', 'iskelesi', 'sahili',
  'tepesi', 'kulesi', 'tower', 'tarihi', 'the', 've', 'and', 'koyu',
  // places and districts — every record in a hub shares them
  'istanbul', 'sultanahmet', 'eminonu', 'sirkeci', 'beyoglu', 'taksim',
  'karakoy', 'galata', 'besiktas', 'ortakoy', 'bebek', 'balat', 'fener',
  'kadikoy', 'moda', 'uskudar', 'adalar', 'buyukada', 'heybeliada',
]);

/**
 * Turkish article titles for places this dataset names in English. Not
 * inventions — the same monument under the name Wikipedia files it as. Without
 * these, "Hagia Sophia" fails to match the article "Ayasofya" sitting nine
 * metres away.
 */
const TR_ALIASES = {
  'Hagia Sophia': 'Ayasofya',
  'Blue Mosque (Sultanahmet Camii)': 'Sultanahmet Camii',
  'Hippodrome (Sultanahmet Meydanı)': 'Sultanahmet Meydanı',
  'Moda Seaside (Sahil)': 'Moda, Kadıköy',
  'Balat Colorful Houses (Kiremit Cd.)': 'Balat, Fatih',
  'Topkapı Palace': 'Topkapı Sarayı',
  'Grand Bazaar (Kapalıçarşı)': 'Kapalıçarşı',
  'Spice Bazaar (Mısır Çarşısı)': 'Mısır Çarşısı',
  'Museum of Turkish & Islamic Arts': 'Türk ve İslam Eserleri Müzesi',
  'Galata Tower': 'Galata Kulesi',
  'Dolmabahçe Palace': 'Dolmabahçe Sarayı',
  'Ortaköy Mosque': 'Ortaköy Camii',
  'Yıldız Park': 'Yıldız Parkı',
  'Gülhane Park': 'Gülhane Parkı',
  'Camondo Steps': 'Kamondo Merdivenleri',
  'Süreyya Opera House': 'Süreyya Operası',
  'Ecumenical Patriarchate (Fener)': 'Fener Rum Patrikhanesi',
  'Kılıç Ali Paşa Mosque & Hamam': 'Kılıç Ali Paşa Camii',
  'Maiden’s Tower': 'Kız Kulesi',
};

const tokens = (s) =>
  new Set(normalise(s).split(' ').filter((w) => w.length > 2 && !STOPWORDS.has(w)));

function namesMatch(ours, theirs) {
  const a = tokens(ours);
  const b = tokens(theirs);

  // An article title that is nothing BUT stopwords is a district or an island
  // — "Eminönü", "Büyükada". Those words are contained in the name of every
  // single thing standing in them, so containment is no evidence at all: it
  // handed the fish-sandwich stall the article about Eminönü the district, and
  // a shopping street the article about the island it is on. Only an exact
  // name will do, which is what lets "Moda, Kadıköy" still match the record
  // that is genuinely about Moda.
  if (b.size === 0 && normalise(ours) !== normalise(theirs)) return false;

  // Whole-string containment runs before the token check and independently of
  // it. Some names are built entirely from stopwords once the district and the
  // generic noun are removed — "Sultanahmet Camii" reduces to nothing — and a
  // token comparison has no evidence left to work with even when the two
  // strings are literally identical.
  const na = normalise(ours).replace(/\s/g, '');
  const nb = normalise(theirs).replace(/\s/g, '');
  if (na.length > 5 && nb.length > 5 && (na.includes(nb) || nb.includes(na))) return true;

  if (a.size === 0 || b.size === 0) return false;
  for (const w of a) if (b.has(w)) return true;
  return false;
}

async function geosearch(lat, lng) {
  const url =
    `${API}?action=query&list=geosearch&format=json&origin=*` +
    `&gscoord=${lat}%7C${lng}&gsradius=${GEO_RADIUS_M}&gslimit=15`;
  // 429s show up even at a polite rate; back off rather than lose the place.
  let res;
  for (let attempt = 1; ; attempt++) {
    res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(20000),
    });
    if (res.ok) break;
    if (res.status === 429 && attempt <= 3) {
      await sleep(REQUEST_INTERVAL_MS * 3 * attempt);
      continue;
    }
    throw new Error(`Wikipedia responded ${res.status}`);
  }
  const body = await res.json();
  return body?.query?.geosearch ?? [];
}

// ── Parse the dataset ───────────────────────────────────────────────────
const source = readFileSync(DATASET, 'utf8');
const places = [
  ...source.matchAll(
    /placeId: '([^']+)',\s*\n\s*name: '((?:[^'\\]|\\.)*)',\s*\n\s*hub: '([^']+)',\s*\n\s*lat: ([-\d.]+),\s*\n\s*lng: ([-\d.]+),/g,
  ),
].map((m) => ({
  placeId: m[1],
  name: m[2].replace(/\\'/g, "'"),
  lat: Number(m[4]),
  lng: Number(m[5]),
}));
if (places.length === 0) throw new Error('parsed no places out of the dataset');

const cache = existsSync(CACHE) ? JSON.parse(readFileSync(CACHE, 'utf8')) : {};

let found = 0;
let none = 0;
/**
 * Places the network never gave an answer for.
 *
 * Tracked separately because they are NOT the same as "no article exists", and
 * conflating them cost a real regression: a transient error on the very first
 * request dropped Hagia Sophia, and the run still finished with a confident
 * "64 matched" that no one had reason to question. An error leaves no cache
 * entry, so a re-run retries exactly these — but only if you know they exist.
 */
const errored = [];
for (const [i, place] of places.entries()) {
  const label = `[${String(i + 1).padStart(3)}/${places.length}] ${place.name}`;
  if (cache[place.placeId] !== undefined) {
    if (cache[place.placeId]) found++;
    else none++;
    continue;
  }

  let results;
  try {
    results = await geosearch(place.lat, place.lng);
  } catch (err) {
    console.log(`${label} — ERROR ${String(err)}`);
    errored.push(place.name);
    await sleep(REQUEST_INTERVAL_MS);
    continue;
  }

  // Match against the Turkish alias when we have one, so an English record
  // still finds its article.
  const subject = TR_ALIASES[place.name] ?? place.name;

  // Among the candidates that pass the name check, prefer the one that is
  // ABOUT the place rather than about a part of it. "Topkapı Palace" matched
  // both "Topkapı Sarayı" and "Topkapı Sarayı mutfakları" — the palace kitchens
  // — and nearest-first happened to return the kitchens. Ranking by how many
  // extra distinctive words the title carries picks the parent article.
  const ours = tokens(subject);
  const extraWords = (title) => [...tokens(title)].filter((w) => !ours.has(w)).length;
  const match = results
    .filter((r) => namesMatch(subject, r.title))
    .sort((a, b) => extraWords(a.title) - extraWords(b.title) || a.dist - b.dist)[0];

  if (match) {
    cache[place.placeId] = match.title;
    found++;
    console.log(`${label} — ${match.title}  (${Math.round(match.dist)} m)`);
  } else {
    cache[place.placeId] = null;
    none++;
    const near = results.slice(0, 2).map((r) => r.title).join(', ');
    console.log(`${label} — no matching article${near ? `  [nearby: ${near}]` : ''}`);
  }
  await sleep(REQUEST_INTERVAL_MS);
}

console.log('\n─────────────────────────────────────────');
console.log(`articles matched : ${found} / ${places.length}`);
console.log(`no match         : ${none}`);
if (errored.length > 0) {
  console.log(`\n⚠  NO ANSWER (network) : ${errored.length} — these are unresolved,`);
  console.log('   not "no article". Re-run to retry exactly these:');
  for (const name of errored) console.log(`     - ${name}`);
}

if (dryRun) {
  console.log('\n--dry-run: nothing written.');
} else {
  writeFileSync(CACHE, JSON.stringify(cache, null, 2) + '\n');

  const byId = new Map(places.map((p) => [p.placeId, p]));
  const entries = Object.entries(cache)
    .filter(([, title]) => title)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([id, title]) => {
      const name = byId.get(id)?.name ?? '';
      const q = (s) => `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
      return `  ${q(id)}: ${q(title)},${name && normalise(name) !== normalise(title) ? ` // ${name}` : ''}`;
    })
    .join('\n');

  const out = `/**
 * Turkish Wikipedia article titles, keyed by placeId.
 *
 * GENERATED by \`node scripts/seed-wikipedia-titles.mjs\` — regenerate rather
 * than editing by hand. Each entry was found by Wikipedia geosearch around the
 * place's own coordinate and then confirmed by a name match, so an article has
 * to be both at the right location and about the right subject.
 *
 * Only titles live here. Article text and thumbnails are fetched live by
 * \`WikipediaClient\` so the CC BY-SA attribution travels with the content and
 * nothing here goes stale.
 *
 * A place with no entry simply gets no Wikipedia panel — the enrichment is
 * additive and never load-bearing.
 */
export const WIKI_TITLES: Record<string, string> = {
${entries}
};
`;
  writeFileSync(TARGET, out);
  console.log(`\nwrote ${TARGET}`);
}
