import { Hub } from '../../domain/place';
import { HubMeta, HubSide } from '../../domain/hub';

/**
 * The ten neighborhood hubs, in the order the selector shows them: European
 * shore south-to-north, then the Asian shore, then the islands.
 *
 * `balat-fener` and `besiktas-bogaz` keep their original two-word slugs while
 * the newer hubs are single-word. That inconsistency is deliberate —
 * `check_ins.hub` stores these strings and production already holds rows using
 * them, so renaming would strand real data to tidy up a name.
 */
export const HUB_DATASET: HubMeta[] = [
  {
    id: 'sultanahmet',
    name: 'Sultanahmet & Old City',
    side: 'European',
    blurb: 'Byzantine + Ottoman monuments packed into a walkable peninsula.',
    center: [41.0086, 28.9785],
    accent: '#C56F52',
  },
  {
    id: 'eminonu-sirkeci',
    name: 'Eminönü & Sirkeci',
    side: 'European',
    blurb: 'Covered bazaars, spice stalls and the ferry horns below them.',
    center: [41.0165, 28.9705],
    accent: '#B0603A',
  },
  {
    id: 'beyoglu-taksim',
    name: 'Beyoğlu & Taksim',
    side: 'European',
    blurb: 'İstiklal, hidden arcades and meyhanes — the city after dark.',
    center: [41.0345, 28.9782],
    accent: '#7A5C9E',
  },
  {
    id: 'karakoy-galata',
    name: 'Karaköy & Galata',
    side: 'European',
    blurb: 'Galata Tower, third-wave coffee, galleries and baklava.',
    center: [41.0243, 28.9748],
    accent: '#4A7C82',
  },
  {
    id: 'besiktas-bogaz',
    name: 'Beşiktaş & Bosphorus',
    side: 'European',
    blurb: 'Palaces, fish markets and student-quarter energy.',
    center: [41.0426, 29.0064],
    accent: '#5E8C74',
  },
  {
    id: 'ortakoy-bebek',
    name: 'Ortaköy & Bebek',
    side: 'European',
    blurb: 'The Bosphorus run — waterside mosque, kumpir, shoreline walks.',
    center: [41.0553, 29.0335],
    accent: '#3E7BA6',
  },
  {
    id: 'balat-fener',
    name: 'Balat & Fener',
    side: 'European',
    blurb: 'Rainbow houses, antique shops and Orthodox heritage.',
    center: [41.0292, 28.9492],
    accent: '#A87F28',
  },
  {
    id: 'kadikoy-moda',
    name: 'Kadıköy & Moda',
    side: 'Asian',
    blurb: 'The Asian side: markets, meyhanes and a seaside sunset.',
    center: [40.9887, 29.027],
    accent: '#C97B8E',
  },
  {
    id: 'uskudar',
    name: 'Üsküdar',
    side: 'Asian',
    blurb: 'Sinan mosques, the Maiden’s Tower view and Kuzguncuk’s lanes.',
    center: [41.0255, 29.0152],
    accent: '#6B8E5A',
  },
  {
    id: 'adalar',
    name: 'Princes’ Islands (Adalar)',
    side: 'Islands',
    blurb: 'A ferry day out — no cars, pine woods and wooden mansions.',
    center: [40.8608, 29.1236],
    accent: '#2E8B87',
  },
  {
    id: 'eyupsultan',
    name: 'Eyüpsultan & Pierre Loti',
    side: 'European',
    blurb: 'Pilgrim quarter, a cable car and the Golden Horn below it.',
    center: [41.0478, 28.9327],
    accent: '#8A6D3B',
  },
  {
    id: 'sariyer',
    name: 'Sarıyer & the Northern Bosphorus',
    side: 'European',
    blurb: 'Fish restaurants, forest and the Black Sea beaches.',
    center: [41.1686, 29.0573],
    accent: '#3F7D5B',
  },
  {
    id: 'nisantasi-sisli',
    name: 'Nişantaşı & Şişli',
    side: 'European',
    blurb: 'Shopping streets, café culture and modern Istanbul.',
    center: [41.0638, 28.9832],
    accent: '#9B5F7E',
  },
  {
    id: 'beykoz-anadolu-kavagi',
    name: 'Beykoz & Anadolu Kavağı',
    side: 'Asian',
    blurb: 'The far north of the strait — a castle, coves and fish.',
    center: [41.1343, 29.092],
    accent: '#4A6E8C',
  },
  {
    id: 'zeytinburnu-bakirkoy',
    name: 'Zeytinburnu & Bakırköy',
    side: 'European',
    blurb: 'Panorama museum, shoreline parks and the Marmara coast.',
    center: [40.9783, 28.8744],
    accent: '#B07A4E',
  },
];

/**
 * Which shore each hub is on, derived from `HUB_DATASET` rather than restated.
 *
 * The route engine needs this per place (a place's side is its hub's side) and
 * a second hand-written copy is exactly the divergence we removed elsewhere:
 * adding a hub here and forgetting it there would silently let the engine plan
 * a walk across the Bosphorus.
 */
export const HUB_SIDE: Record<Hub, HubSide> = Object.fromEntries(
  HUB_DATASET.map((h) => [h.id, h.side]),
) as Record<Hub, HubSide>;

/**
 * Transit hubs / ferry piers offered as route start points (IBB Open Data).
 * Not hubs in the planning sense — these are just well-known arrival points.
 */
export const TRANSIT_HUBS: { label: string; lat: number; lng: number }[] = [
  { label: 'Eminönü Pier', lat: 41.0175, lng: 28.9705 },
  { label: 'Kadıköy Pier', lat: 40.9925, lng: 29.0213 },
  { label: 'Karaköy Pier', lat: 41.0223, lng: 28.9776 },
  { label: 'Sirkeci Marmaray', lat: 41.0138, lng: 28.9772 },
  { label: 'Üsküdar Pier', lat: 41.0255, lng: 29.0148 },
  { label: 'Taksim Metro', lat: 41.0369, lng: 28.9857 },
  { label: 'Beşiktaş Pier', lat: 41.0409, lng: 29.0053 },
  { label: 'Büyükada Pier', lat: 40.8757, lng: 29.1288 },
];
