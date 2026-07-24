import type { HubMeta, Place } from './types';

/**
 * Hub + place data.
 *
 * `PLACES` is shaped exactly like a Google Places API response merged with IBB
 * Open Data (place_id, lat/lng, rating, reviewCount, photo_url, opening_hours,
 * entry fee, museum-pass validity). In production `api.getPlaces()` would call
 * the backend `/api/places` (itself backed by Google Places); here it returns
 * this array so the map works fully offline. Kept in sync with the backend
 * dataset in `pathwise-backend/.../place.dataset.ts`.
 */

export const HUBS: HubMeta[] = [
  {
    id: 'sultanahmet',
    name: 'Sultanahmet & Old City',
    side: 'European',
    blurb: 'Byzantine + Ottoman monuments packed into a walkable peninsula.',
    center: [41.0086, 28.9785],
    accent: '#FF7E5F',
  },
  {
    id: 'karakoy-galata',
    name: 'Karaköy & Galata',
    side: 'European',
    blurb: 'Galata Tower, third-wave coffee, galleries and baklava.',
    center: [41.0243, 28.9748],
    accent: '#8B5CF6',
  },
  {
    id: 'kadikoy-moda',
    name: 'Kadıköy & Moda',
    side: 'Asian',
    blurb: 'The Asian side: markets, meyhanes and a seaside sunset.',
    center: [40.9887, 29.027],
    accent: '#EC4899',
  },
  {
    id: 'balat-fener',
    name: 'Balat & Fener',
    side: 'European',
    blurb: 'Rainbow houses, antique shops and Orthodox heritage.',
    center: [41.0292, 28.9492],
    accent: '#10B981',
  },
  {
    id: 'besiktas-bogaz',
    name: 'Beşiktaş & Bosphorus',
    side: 'European',
    blurb: 'Palaces, fish markets and the Bosphorus shoreline.',
    center: [41.0455, 29.0087],
    accent: '#6B21A8',
  },
];

export const HUB_BY_ID: Record<string, HubMeta> = Object.fromEntries(
  HUBS.map((h) => [h.id, h]),
);

// Transit hubs / ferry piers for the start-point selector (IBB Open Data).
export const TRANSIT_HUBS: { label: string; lat: number; lng: number }[] = [
  { label: 'Eminönü Pier', lat: 41.0175, lng: 28.9705 },
  { label: 'Kadıköy Pier', lat: 40.9925, lng: 29.0213 },
  { label: 'Karaköy Pier', lat: 41.0223, lng: 28.9776 },
  { label: 'Sirkeci Marmaray', lat: 41.0138, lng: 28.9772 },
  { label: 'Üsküdar Pier', lat: 41.0255, lng: 29.0148 },
];

export const PLACES: Place[] = [
  // ── Sultanahmet & Old City ──
  { placeId: 'ChIJ-sultanahmet-hagiasophia', name: 'Hagia Sophia', hub: 'sultanahmet', lat: 41.0086, lng: 28.9802, rating: 4.8, reviewCount: 312840, photoUrl: 'https://images.pathwise.mock/hagia-sophia.jpg', category: 'history', interests: ['history', 'photo'], entryFeeTry: 1500, avgFoodCostTry: 0, avgVisitMinutes: 75, openingHours: 'Daily 09:00–19:00', isIndoor: true, isSunsetSpot: false, museumPass: true, localTip: 'Enter from the side gate for the upper gallery — far shorter queue.' },
  { placeId: 'ChIJ-sultanahmet-bluemosque', name: 'Blue Mosque (Sultanahmet Camii)', hub: 'sultanahmet', lat: 41.0054, lng: 28.9768, rating: 4.7, reviewCount: 198220, photoUrl: 'https://images.pathwise.mock/blue-mosque.jpg', category: 'history', interests: ['history', 'photo'], entryFeeTry: 0, avgFoodCostTry: 0, avgVisitMinutes: 45, openingHours: 'Daily, closed to visitors during prayer times', isIndoor: true, isSunsetSpot: false, museumPass: false, localTip: 'Bring a scarf; shoulders and knees must be covered inside.' },
  { placeId: 'ChIJ-sultanahmet-topkapi', name: 'Topkapı Palace', hub: 'sultanahmet', lat: 41.0115, lng: 28.9834, rating: 4.7, reviewCount: 156900, photoUrl: 'https://images.pathwise.mock/topkapi.jpg', category: 'history', interests: ['history', 'photo'], entryFeeTry: 1700, avgFoodCostTry: 0, avgVisitMinutes: 120, openingHours: 'Wed–Mon 09:00–18:00 (closed Tue)', isIndoor: true, isSunsetSpot: false, museumPass: true, localTip: 'The Harem needs a separate ticket but is the highlight — buy it.' },
  { placeId: 'ChIJ-sultanahmet-basilicacistern', name: 'Basilica Cistern (Yerebatan Sarnıcı)', hub: 'sultanahmet', lat: 41.0084, lng: 28.9779, rating: 4.6, reviewCount: 142300, photoUrl: 'https://images.pathwise.mock/yerebatan.jpg', category: 'history', interests: ['history', 'photo'], entryFeeTry: 900, avgFoodCostTry: 0, avgVisitMinutes: 40, openingHours: 'Daily 09:00–22:00', isIndoor: true, isSunsetSpot: false, museumPass: false, localTip: 'Great rainy-day stop — fully underground and atmospheric.' },
  { placeId: 'ChIJ-sultanahmet-grandbazaar', name: 'Grand Bazaar (Kapalıçarşı)', hub: 'sultanahmet', lat: 41.0106, lng: 28.968, rating: 4.5, reviewCount: 220110, photoUrl: 'https://images.pathwise.mock/grand-bazaar.jpg', category: 'market', interests: ['market', 'photo'], entryFeeTry: 0, avgFoodCostTry: 180, avgVisitMinutes: 60, openingHours: 'Mon–Sat 09:00–19:00 (closed Sun)', isIndoor: true, isSunsetSpot: false, museumPass: false, localTip: 'Prices drop 30–40% if you walk away once — haggling is expected.' },
  { placeId: 'ChIJ-sultanahmet-gulhane', name: 'Gülhane Park', hub: 'sultanahmet', lat: 41.0134, lng: 28.9812, rating: 4.6, reviewCount: 63400, photoUrl: 'https://images.pathwise.mock/gulhane.jpg', category: 'nature', interests: ['nature', 'photo'], entryFeeTry: 0, avgFoodCostTry: 120, avgVisitMinutes: 45, openingHours: 'Daily 06:00–22:30', isIndoor: false, isSunsetSpot: true, museumPass: false, localTip: 'The far terrace has a free Bosphorus view most tourists miss.' },

  // ── Karaköy & Galata ──
  { placeId: 'ChIJ-galata-tower', name: 'Galata Tower', hub: 'karakoy-galata', lat: 41.0256, lng: 28.9744, rating: 4.6, reviewCount: 178500, photoUrl: 'https://images.pathwise.mock/galata-tower.jpg', category: 'history', interests: ['history', 'photo'], entryFeeTry: 1000, avgFoodCostTry: 0, avgVisitMinutes: 50, openingHours: 'Daily 08:30–23:00', isIndoor: true, isSunsetSpot: true, museumPass: true, localTip: 'Go 45 min before sunset for golden-hour light over the Horn.' },
  { placeId: 'ChIJ-galata-karakoylokantasi', name: 'Karaköy Lokantası', hub: 'karakoy-galata', lat: 41.0242, lng: 28.9776, rating: 4.6, reviewCount: 21400, photoUrl: 'https://images.pathwise.mock/karakoy-lokantasi.jpg', category: 'food', interests: ['food'], entryFeeTry: 0, avgFoodCostTry: 650, avgVisitMinutes: 75, openingHours: 'Mon–Sat 12:00–16:00, 19:00–23:00', isIndoor: true, isSunsetSpot: false, museumPass: false, localTip: 'The turquoise-tiled meyhane; book ahead for dinner, walk-in at lunch.' },
  { placeId: 'ChIJ-galata-saltgalata', name: 'SALT Galata', hub: 'karakoy-galata', lat: 41.0231, lng: 28.9741, rating: 4.5, reviewCount: 9800, photoUrl: 'https://images.pathwise.mock/salt-galata.jpg', category: 'art', interests: ['art', 'history'], entryFeeTry: 0, avgFoodCostTry: 220, avgVisitMinutes: 60, openingHours: 'Tue–Sun 10:00–18:00 (closed Mon)', isIndoor: true, isSunsetSpot: false, museumPass: false, localTip: 'Free contemporary art space in the old Ottoman Bank — great café.' },
  { placeId: 'ChIJ-galata-gulluoglu', name: 'Karaköy Güllüoğlu', hub: 'karakoy-galata', lat: 41.0231, lng: 28.9781, rating: 4.6, reviewCount: 44200, photoUrl: 'https://images.pathwise.mock/gulluoglu.jpg', category: 'food', interests: ['food'], entryFeeTry: 0, avgFoodCostTry: 160, avgVisitMinutes: 30, openingHours: 'Daily 07:00–22:00', isIndoor: true, isSunsetSpot: false, museumPass: false, localTip: 'Order the pistachio baklava by weight; pay the cashier first.' },
  { placeId: 'ChIJ-galata-camondo', name: 'Camondo Steps', hub: 'karakoy-galata', lat: 41.0243, lng: 28.9737, rating: 4.4, reviewCount: 15600, photoUrl: 'https://images.pathwise.mock/camondo.jpg', category: 'photo', interests: ['photo', 'history'], entryFeeTry: 0, avgFoodCostTry: 0, avgVisitMinutes: 20, openingHours: 'Always open', isIndoor: false, isSunsetSpot: false, museumPass: false, localTip: 'Shoot from the bottom looking up for the famous Art Nouveau curve.' },

  // ── Kadıköy & Moda ──
  { placeId: 'ChIJ-kadikoy-carsi', name: 'Kadıköy Market (Çarşı)', hub: 'kadikoy-moda', lat: 40.9903, lng: 29.0277, rating: 4.7, reviewCount: 58900, photoUrl: 'https://images.pathwise.mock/kadikoy-carsi.jpg', category: 'market', interests: ['market', 'food', 'photo'], entryFeeTry: 0, avgFoodCostTry: 250, avgVisitMinutes: 60, openingHours: 'Daily 08:00–20:00', isIndoor: false, isSunsetSpot: false, museumPass: false, localTip: 'Graze: pickles at Şükrü, Turkish delight at Hacı Bekir, fish sandwiches.' },
  { placeId: 'ChIJ-kadikoy-ciya', name: 'Çiya Sofrası', hub: 'kadikoy-moda', lat: 40.9899, lng: 29.0271, rating: 4.6, reviewCount: 33100, photoUrl: 'https://images.pathwise.mock/ciya.jpg', category: 'food', interests: ['food'], entryFeeTry: 0, avgFoodCostTry: 420, avgVisitMinutes: 70, openingHours: 'Daily 11:00–22:00', isIndoor: true, isSunsetSpot: false, museumPass: false, localTip: 'Point-and-pick Anatolian dishes; the tatlı is unique.' },
  { placeId: 'ChIJ-kadikoy-moda-sahil', name: 'Moda Seaside (Sahil)', hub: 'kadikoy-moda', lat: 40.9812, lng: 29.024, rating: 4.7, reviewCount: 41200, photoUrl: 'https://images.pathwise.mock/moda-sahil.jpg', category: 'nature', interests: ['nature', 'photo'], entryFeeTry: 0, avgFoodCostTry: 90, avgVisitMinutes: 50, openingHours: 'Always open', isIndoor: false, isSunsetSpot: true, museumPass: false, localTip: 'Grab a çay and watch the sun set behind the peninsula.' },
  { placeId: 'ChIJ-kadikoy-moda-icecream', name: 'Moda Dondurma (Ali Usta)', hub: 'kadikoy-moda', lat: 40.9836, lng: 29.0263, rating: 4.5, reviewCount: 27600, photoUrl: 'https://images.pathwise.mock/ali-usta.jpg', category: 'food', interests: ['food'], entryFeeTry: 0, avgFoodCostTry: 110, avgVisitMinutes: 20, openingHours: 'Daily 10:00–00:00', isIndoor: false, isSunsetSpot: false, museumPass: false, localTip: 'Expect a queue in summer; the sakızlı scoop is the local pick.' },
  { placeId: 'ChIJ-kadikoy-barlar', name: 'Kadıköy Barlar Sokağı', hub: 'kadikoy-moda', lat: 40.9895, lng: 29.0292, rating: 4.4, reviewCount: 18400, photoUrl: 'https://images.pathwise.mock/barlar-sokagi.jpg', category: 'food', interests: ['food', 'art'], entryFeeTry: 0, avgFoodCostTry: 380, avgVisitMinutes: 60, openingHours: 'Daily 16:00–02:00', isIndoor: false, isSunsetSpot: false, museumPass: false, localTip: 'Best after dark; live music spills out of the side streets on weekends.' },
  { placeId: 'ChIJ-kadikoy-sureyya', name: 'Süreyya Opera House', hub: 'kadikoy-moda', lat: 40.9906, lng: 29.0286, rating: 4.6, reviewCount: 8700, photoUrl: 'https://images.pathwise.mock/sureyya.jpg', category: 'art', interests: ['art', 'history', 'photo'], entryFeeTry: 0, avgFoodCostTry: 0, avgVisitMinutes: 30, openingHours: 'Lobby daily; performances evenings', isIndoor: true, isSunsetSpot: false, museumPass: false, localTip: 'The 1927 façade on Bahariye is a photo stop even without a show.' },

  // ── Balat & Fener ──
  { placeId: 'ChIJ-balat-colorfulhouses', name: 'Balat Colorful Houses (Kiremit Cd.)', hub: 'balat-fener', lat: 41.0294, lng: 28.9487, rating: 4.6, reviewCount: 52300, photoUrl: 'https://images.pathwise.mock/balat-houses.jpg', category: 'photo', interests: ['photo', 'history'], entryFeeTry: 0, avgFoodCostTry: 0, avgVisitMinutes: 45, openingHours: 'Always open', isIndoor: false, isSunsetSpot: false, museumPass: false, localTip: 'Kiremit & Merdivenli Yokuş have the rainbow terraces — mornings are quietest.' },
  { placeId: 'ChIJ-balat-fenerpatriarchate', name: 'Ecumenical Patriarchate (Fener)', hub: 'balat-fener', lat: 41.0293, lng: 28.9513, rating: 4.6, reviewCount: 12100, photoUrl: 'https://images.pathwise.mock/patriarchate.jpg', category: 'history', interests: ['history'], entryFeeTry: 0, avgFoodCostTry: 0, avgVisitMinutes: 35, openingHours: 'Daily 09:00–17:00', isIndoor: true, isSunsetSpot: false, museumPass: false, localTip: 'The seat of the Greek Orthodox church; modest dress appreciated.' },
  { placeId: 'ChIJ-balat-agora', name: 'Agora Meyhanesi 1890', hub: 'balat-fener', lat: 41.0286, lng: 28.9497, rating: 4.5, reviewCount: 9600, photoUrl: 'https://images.pathwise.mock/agora-meyhanesi.jpg', category: 'food', interests: ['food'], entryFeeTry: 0, avgFoodCostTry: 550, avgVisitMinutes: 80, openingHours: 'Daily 12:00–00:00', isIndoor: true, isSunsetSpot: false, museumPass: false, localTip: 'A 130-year-old meyhane; order the meze board and rakı like a local.' },
  { placeId: 'ChIJ-balat-antiqueshops', name: 'Balat Antique & Vintage Shops', hub: 'balat-fener', lat: 41.0301, lng: 28.9479, rating: 4.4, reviewCount: 6400, photoUrl: 'https://images.pathwise.mock/balat-antiques.jpg', category: 'market', interests: ['market', 'art', 'photo'], entryFeeTry: 0, avgFoodCostTry: 0, avgVisitMinutes: 40, openingHours: 'Tue–Sun 10:00–19:00', isIndoor: true, isSunsetSpot: false, museumPass: false, localTip: 'Perfect rainy detour; the antikacı shops around Vodina Cd. are treasure troves.' },
  { placeId: 'ChIJ-balat-cafe', name: 'Forno Balat (Café)', hub: 'balat-fener', lat: 41.029, lng: 28.9482, rating: 4.5, reviewCount: 14300, photoUrl: 'https://images.pathwise.mock/forno-balat.jpg', category: 'food', interests: ['food', 'photo'], entryFeeTry: 0, avgFoodCostTry: 240, avgVisitMinutes: 45, openingHours: 'Daily 08:00–20:00', isIndoor: true, isSunsetSpot: false, museumPass: false, localTip: 'Old stone bakery-café; the simit-and-menemen breakfast is the move.' },

  // ── Beşiktaş & Bosphorus ──
  { placeId: 'ChIJ-besiktas-dolmabahce', name: 'Dolmabahçe Palace', hub: 'besiktas-bogaz', lat: 41.0392, lng: 29.0001, rating: 4.7, reviewCount: 121700, photoUrl: 'https://images.pathwise.mock/dolmabahce.jpg', category: 'history', interests: ['history', 'photo'], entryFeeTry: 1450, avgFoodCostTry: 0, avgVisitMinutes: 90, openingHours: 'Tue–Sun 09:00–16:00 (closed Mon)', isIndoor: true, isSunsetSpot: false, museumPass: false, localTip: 'Photography is limited inside; the waterfront clock tower is the free shot.' },
  { placeId: 'ChIJ-besiktas-ortakoy-mosque', name: 'Ortaköy Mosque', hub: 'besiktas-bogaz', lat: 41.0473, lng: 29.0272, rating: 4.7, reviewCount: 88100, photoUrl: 'https://images.pathwise.mock/ortakoy.jpg', category: 'photo', interests: ['photo', 'history'], entryFeeTry: 0, avgFoodCostTry: 0, avgVisitMinutes: 40, openingHours: 'Daily, outside prayer times', isIndoor: false, isSunsetSpot: true, museumPass: false, localTip: 'Frame the mosque with the Bosphorus Bridge behind it from the square.' },
  { placeId: 'ChIJ-besiktas-ortakoy-kumpir', name: 'Ortaköy Kumpir & Waffle Row', hub: 'besiktas-bogaz', lat: 41.0476, lng: 29.0266, rating: 4.4, reviewCount: 36700, photoUrl: 'https://images.pathwise.mock/kumpir.jpg', category: 'food', interests: ['food'], entryFeeTry: 0, avgFoodCostTry: 200, avgVisitMinutes: 35, openingHours: 'Daily 10:00–00:00', isIndoor: false, isSunsetSpot: false, museumPass: false, localTip: 'Loaded baked potato (kumpir) is the signature; pick your toppings.' },
  { placeId: 'ChIJ-besiktas-yildiz-park', name: 'Yıldız Park', hub: 'besiktas-bogaz', lat: 41.0501, lng: 29.0125, rating: 4.6, reviewCount: 42800, photoUrl: 'https://images.pathwise.mock/yildiz-park.jpg', category: 'nature', interests: ['nature', 'photo'], entryFeeTry: 0, avgFoodCostTry: 130, avgVisitMinutes: 60, openingHours: 'Daily 07:00–22:00', isIndoor: false, isSunsetSpot: true, museumPass: false, localTip: 'Climb to Malta Köşkü café for a hilltop Bosphorus panorama.' },
  { placeId: 'ChIJ-besiktas-fishmarket', name: 'Beşiktaş Fish Market', hub: 'besiktas-bogaz', lat: 41.0426, lng: 29.0064, rating: 4.5, reviewCount: 19700, photoUrl: 'https://images.pathwise.mock/besiktas-fishmarket.jpg', category: 'market', interests: ['market', 'food'], entryFeeTry: 0, avgFoodCostTry: 480, avgVisitMinutes: 55, openingHours: 'Daily 09:00–22:00', isIndoor: false, isSunsetSpot: false, museumPass: false, localTip: 'Pick a fish at the stalls and a nearby lokanta will cook it for you.' },
  { placeId: 'ChIJ-besiktas-bebek-sahil', name: 'Bebek Seaside', hub: 'besiktas-bogaz', lat: 41.0776, lng: 29.0433, rating: 4.7, reviewCount: 51200, photoUrl: 'https://images.pathwise.mock/bebek-sahil.jpg', category: 'nature', interests: ['nature', 'photo', 'food'], entryFeeTry: 0, avgFoodCostTry: 260, avgVisitMinutes: 50, openingHours: 'Always open', isIndoor: false, isSunsetSpot: true, museumPass: false, localTip: 'Grab a coffee at Bebek Kahve and sit on the sea wall.' },
];

export const PLACES_BY_ID: Record<string, Place> = Object.fromEntries(
  PLACES.map((p) => [p.placeId, p]),
);
