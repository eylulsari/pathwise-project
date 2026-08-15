/**
 * Turns the raw batch-2 drop into something the rest of the pipeline accepts.
 *
 * The incoming file is hand-authored and carries three kinds of problem that
 * are cheaper to fix once, here, than to work around in five later steps:
 *
 *  1. **Hub slugs that do not exist.** It used `besiktas` and `balat`; the real
 *     ids are `besiktas-bogaz` and `balat-fener`, which are the strings
 *     `check_ins.hub` holds in production.
 *  2. **Interest values outside the enum.** Nine of them. Six were mapped onto
 *     existing values and three were added to the enum — see the table below,
 *     which is the whole record of that decision.
 *  3. **Places already in the catalogue.** Two, both confirmed by name against
 *     the live dataset rather than by eye.
 *
 * Output: scripts/data/pathwise-places-batch2.normalised.json, in the shape
 * the geocoder reads.
 *
 * Usage: node scripts/normalise-batch2.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const INPUT = resolve(here, 'data/pathwise-places-batch2.json');
const OUTPUT = resolve(here, 'data/pathwise-places-batch2.normalised.json');

/** Hub ids the drop got wrong. */
const HUB_FIXES = {
  besiktas: 'besiktas-bogaz',
  balat: 'balat-fener',
};

/**
 * How each non-enum interest was resolved.
 *
 * `walk`, `architecture` and `family` became new enum values: they carry a
 * meaning nothing else does, and between them they tag 36 records. Forcing
 * `walk` onto `relax` would say something different about a shoreline route
 * than the data means.
 *
 * The rest map cleanly. `beach`, `sport` and `hiking` all land on `nature` —
 * they are outdoor activity, and each would otherwise open an axis for one or
 * two records.
 */
const INTEREST_MAP = {
  photography: 'photo',
  shopping: 'market',
  dessert: 'food',
  beach: 'nature',
  sport: 'nature',
  hiking: 'nature',
  walk: 'walk',
  architecture: 'architecture',
  family: 'family',
};

/**
 * Places the catalogue already holds. Both were found by matching names
 * against the live dataset, not by reading the list.
 *
 * "Kılıç Ali Paşa Camii" is the same mosque as the existing "Kılıç Ali Paşa
 * Mosque & Hamam" — and the drop filed it under `beyoglu-taksim`, while the
 * mosque stands in Tophane, inside `karakoy-galata` where the existing record
 * already sits.
 */
const ALREADY_HAVE = new Set(['Namlı Gurme', 'Kılıç Ali Paşa Camii']);

/**
 * Places the drop filed on the wrong shore.
 *
 * Kanlıca and Mihrabat are on the **Asian** side of the Bosphorus, but the
 * drop put them in `ortakoy-bebek`, which is European. That is not a cosmetic
 * error: the route engine reads a hub's side to decide walk versus ferry, so
 * it would have planned a stroll across the strait.
 */
const HUB_CORRECTIONS = {
  'Kanlıca Yoğurdu': 'beykoz-anadolu-kavagi',
  'Mihrabat Korusu': 'beykoz-anadolu-kavagi',
  // Balat pier is in Fatih, inside the Balat hub — the drop filed it under
  // Eyüpsultan because both look out over the same water.
  'Balat Vapur İskelesi Manzarası (Haliç)': 'balat-fener',
};

/**
 * Explicit search strings for places whose display name is not what the map
 * calls them. Without these Nominatim either finds nothing or — worse — finds
 * a same-named thing elsewhere: "Zal Mahmut Paşa Camii" resolved to *Mahmut
 * Paşa Camii* in Fatih, a different mosque entirely.
 *
 * Only names that identify a real, mappable feature get an entry. A record
 * like "Sarıyer Balıkçıları" describes a category of restaurant rather than a
 * place, and no query string will make it one.
 */
const NAME_QUERIES = {
  'Zal Mahmut Paşa Camii': 'Zal Mahmud Paşa Camii, Eyüpsultan',
  'Eyüp Sultan Pilavcısı': 'Eyüpsultan, İstanbul',
  'Sarıyer Börekçisi': 'Sarıyer Merkez, Sarıyer',
  Asmalımescit: 'Asmalımescit, Beyoğlu',
  'Çinili Camii': 'Çinili Camii, Üsküdar',
  'Salacak Sahili': 'Salacak, Üsküdar',
  'Vodafone Park Çevresi': 'Beşiktaş Stadyumu, Beşiktaş',
  'Kurşunlu Han': 'Kurşunlu Mahzen Camii, Karaköy',
  'Kuru Kahveci Mehmet Efendi': 'Kurukahveci Mehmet Efendi, Eminönü',
  'Harbiye Askeri Müzesi': 'Askerî Müze, Harbiye',
  'Balat Sahili': 'Balat, Fatih',
  'Baltalimanı Sahili': 'Baltalimanı, Sarıyer',
  'Kanlıca Yoğurdu': 'Kanlıca, Beykoz',
  'Anadolu Kavağı Balıkçıları': 'Anadolu Kavağı, Beykoz',
  'Beykoz Çeşmesi ve Çarşı': 'Beykoz Çarşı, Beykoz',
  'Büyükdere Sahili': 'Büyükdere, Sarıyer',
  'Yeniköy Sahil': 'Yeniköy, Sarıyer',
  'Tarabya Koyu': 'Tarabya, Sarıyer',
  'İstinye Sahili': 'İstinye, Sarıyer',
  'Şişli Etfal Sokakları (Kurtuluş)': 'Kurtuluş, Şişli',
  'Nişantaşı Kahve Sokakları': 'Nişantaşı, Şişli',
  'Hüseyin Avni Paşa Konağı Sokakları (Çukurcuma)': 'Çukurcuma, Beyoğlu',
  'Pierre Loti Tepesi': 'Piyer Loti Tepesi, Eyüpsultan',
  'Eyüp Teleferiği': 'Eyüp Teleferik, Eyüpsultan',
  "Ortaköy'e Sahil Yürüyüşü (Beşiktaş)": 'Ortaköy, Beşiktaş',
  'Haliç Sahil Yürüyüş Yolu (Eyüp)': 'Eyüpsultan Sahili, Eyüpsultan',
  'Balat Vapur İskelesi Manzarası (Haliç)': 'Balat İskelesi, Fatih',
  'İstanbul Kongre Merkezi Çevresi': 'İstanbul Kongre Merkezi, Şişli',
};

const raw = JSON.parse(readFileSync(INPUT, 'utf8'));

const dropped = [];
const places = [];
const unmapped = new Set();

for (const place of raw.places) {
  if (ALREADY_HAVE.has(place.name)) {
    dropped.push(place.name);
    continue;
  }
  const interests = [];
  for (const value of place.interests) {
    const mapped = INTEREST_MAP[value] ?? value;
    if (!interests.includes(mapped)) interests.push(mapped);
  }
  const hub = HUB_CORRECTIONS[place.name] ?? HUB_FIXES[place.hub] ?? place.hub;
  places.push({
    ...place,
    hub,
    interests,
    ...(NAME_QUERIES[place.name] ? { nameQuery: NAME_QUERIES[place.name] } : {}),
  });
}

// Anything still outside the enum after mapping is a value nobody decided on,
// and it must not reach the dataset silently.
const ENUM = new Set([
  'food', 'history', 'photo', 'market', 'art', 'nature', 'view', 'hiddengem',
  'relax', 'local', 'culture', 'nightlife', 'experience', 'religion',
  'walk', 'architecture', 'family',
]);
for (const p of places) for (const i of p.interests) if (!ENUM.has(i)) unmapped.add(i);
if (unmapped.size > 0) {
  console.error(`✗ interests with no enum value: ${[...unmapped].join(', ')}`);
  process.exit(1);
}

const newHubs = raw.newHubs.map((h) => ({
  ...h,
  side: h.side === 'asian' ? 'Asian' : 'European',
}));

writeFileSync(OUTPUT, JSON.stringify({ newHubs, places }, null, 2) + '\n');

console.log(`hubs      : ${newHubs.length}`);
console.log(`places in : ${raw.places.length}`);
console.log(`dropped   : ${dropped.length} — ${dropped.join(', ')}`);
console.log(`places out: ${places.length}`);
console.log(`wrote ${OUTPUT}`);
