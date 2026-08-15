/**
 * Checks each geocoded coordinate against the district it ought to be in.
 *
 * WHY THE DISTANCE CHECK IS NOT ENOUGH
 * `geocode-places.mjs` rejects a hit that lands outside Istanbul or too far
 * from its hub centre. That catches Kazakhstan; it does not catch a same-named
 * feature a few kilometres away. The batch-2 hubs are whole districts — Sarıyer
 * reaches the Black Sea, Beykoz runs to Poyrazköy — so their radius has to be
 * generous, and a generous radius is exactly what a wrong-but-nearby hit slips
 * through. Two did: "Zal Mahmut Paşa Camii" landed near Süleymaniye and
 * "Sarıyer Börekçisi" landed in Üsküdar, both comfortably inside the limit.
 *
 * Reverse geocoding answers a different question — not "how far is this?" but
 * "what district is this in?" — and the two together are much harder to fool.
 *
 * Usage: node scripts/verify-districts.mjs [--input data/…normalised.json]
 * Reports only. Nothing is written; the operator decides what to drop.
 */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as sleep } from 'node:timers/promises';

const here = dirname(fileURLToPath(import.meta.url));
const inputArg = process.argv.indexOf('--input');
const INPUT = resolve(
  here,
  inputArg === -1 ? 'data/pathwise-places-batch2.normalised.json' : process.argv[inputArg + 1],
);
const GEOCODED = resolve(here, 'data/geocoded.json');

const USER_AGENT = 'Pathwise/1.0 (Istanbul travel planner; one-off dataset seeding)';
const REQUEST_INTERVAL_MS = 1100;

/**
 * Districts a hub may legitimately reach into.
 *
 * Several are deliberately more than one, because Istanbul's administrative
 * boundaries cut through the neighbourhoods people actually name: Yedikule is
 * in Fatih but belongs to the Zeytinburnu day, Baltalimanı is in Sarıyer but
 * sits on the Bosphorus run, and Maçka straddles Şişli and Beşiktaş.
 */
const ALLOWED = {
  sultanahmet: ['fatih'],
  'eminonu-sirkeci': ['fatih'],
  'beyoglu-taksim': ['beyoglu', 'sisli'],
  'karakoy-galata': ['beyoglu'],
  'besiktas-bogaz': ['besiktas'],
  'ortakoy-bebek': ['besiktas', 'sariyer'],
  'balat-fener': ['fatih'],
  'kadikoy-moda': ['kadikoy'],
  uskudar: ['uskudar'],
  adalar: ['adalar'],
  // Miniatürk and the Rahmi M. Koç museum are administratively in Beyoğlu but
  // stand on the Golden Horn beside Eyüp, which is the day they belong to.
  eyupsultan: ['eyupsultan', 'eyup', 'beyoglu'],
  // Belgrad Forest straddles the Sarıyer/Eyüpsultan boundary.
  sariyer: ['sariyer', 'eyupsultan'],
  'nisantasi-sisli': ['sisli', 'besiktas'],
  'beykoz-anadolu-kavagi': ['beykoz', 'uskudar'],
  'zeytinburnu-bakirkoy': ['zeytinburnu', 'bakirkoy', 'fatih', 'gungoren', 'bahcelievler'],
};

const FOLD = { ı: 'i', ş: 's', ğ: 'g', ü: 'u', ö: 'o', ç: 'c', â: 'a', î: 'i', û: 'u' };
const fold = (s) =>
  String(s ?? '').toLocaleLowerCase('tr').replace(/[ışğüöçâîû]/g, (c) => FOLD[c] ?? c);

async function reverse(lat, lng) {
  const url =
    `https://nominatim.openstreetmap.org/reverse?format=jsonv2` +
    `&lat=${lat}&lon=${lng}&zoom=10&addressdetails=1`;
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!res.ok) throw new Error(`reverse responded ${res.status}`);
  const body = await res.json();
  const a = body.address ?? {};
  // Istanbul's districts come back under different keys depending on the
  // feature, and sometimes under none of them — so fall back to scanning the
  // full display name, which always spells the district out. Without that,
  // Florya's museum reported an empty district and looked like a mismatch.
  const keyed = a.county ?? a.town ?? a.city_district ?? a.municipality ?? a.suburb;
  return keyed || body.display_name || '';
}

const { places } = JSON.parse(readFileSync(INPUT, 'utf8'));
const geocoded = existsSync(GEOCODED) ? JSON.parse(readFileSync(GEOCODED, 'utf8')) : {};
delete geocoded._failures;

const mismatches = [];
let checked = 0;
let ok = 0;

for (const place of places) {
  const hit = geocoded[place.name];
  if (!hit) continue;
  checked++;
  let district = '';
  try {
    district = await reverse(hit.lat, hit.lng);
  } catch (err) {
    console.log(`  ? ${place.name} — reverse failed: ${String(err)}`);
    await sleep(REQUEST_INTERVAL_MS);
    continue;
  }
  const allowed = ALLOWED[place.hub] ?? [];
  const found = fold(district);
  if (allowed.some((d) => found.includes(d))) {
    ok++;
  } else {
    mismatches.push({ place, district, hit });
    console.log(`  ✗ ${place.name} [${place.hub}] → ${district || '(unknown)'}`);
  }
  await sleep(REQUEST_INTERVAL_MS);
}

console.log('\n─────────────────────────────────────────');
console.log(`checked   : ${checked}`);
console.log(`in district: ${ok}`);
console.log(`MISMATCHED : ${mismatches.length}`);
for (const m of mismatches) {
  console.log(`\n  ${m.place.name}  [expected ${m.place.hub} → ${ALLOWED[m.place.hub]?.join('/')}]`);
  console.log(`    got ${m.district} at ${m.hit.lat}, ${m.hit.lng}`);
  console.log(`    ${m.hit.displayName ?? ''}`);
}
