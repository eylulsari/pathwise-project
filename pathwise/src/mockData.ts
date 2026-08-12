import type {
  Badge,
  PastTrip,
  ProfileStats,
  Tour,
} from './types';

/**
 * Mock records for the social graph, profile and tours.
 *
 * Sources these are shaped after:
 *  - Traveler / CheckIn / buddy connections → Firebase/PostgreSQL user tables
 *  - Tour + source badges                   → GetYourGuide / TripAdvisor APIs
 *  - Weather widget                         → OpenWeatherMap current-conditions
 * `api.ts` returns these with a simulated delay; each call documents the real
 * endpoint it would hit in production.
 */

// ── Weather (OpenWeatherMap current-conditions shape) ──────────────
export const CURRENT_WEATHER = {
  city: 'Istanbul',
  tempC: 26,
  condition: 'Sunny',
  icon: '☀️',
  crowdLevel: 'Moderate' as 'Low' | 'Moderate' | 'High',
};

// TRAVELERS moved to the generated `travelerData.ts` — it is derived from the
// backend seed now, not maintained here. Re-exported so existing imports from
// `mockData` keep working.
export { TRAVELERS } from './travelerData';

export const BADGES: Badge[] = [
  { id: 'old-city-master', emoji: '🕌', name: 'Old City Master', description: 'Visit 5 monuments in Sultanahmet.', earned: true, progress: 100 },
  { id: 'ferry-hopper', emoji: '🚢', name: 'Ferry Hopper', description: 'Cross the Bosphorus by ferry 3 times.', earned: true, progress: 100 },
  { id: 'kahve-guru', emoji: '☕', name: 'Kahve Guru', description: 'Try Turkish coffee at 4 different spots.', earned: false, progress: 75 },
  { id: 'market-forager', emoji: '🧺', name: 'Market Forager', description: 'Explore 3 neighborhood markets.', earned: false, progress: 66 },
  { id: 'sunset-chaser', emoji: '🌅', name: 'Sunset Chaser', description: 'Catch golden hour at 5 viewpoints.', earned: false, progress: 40 },
  // One badge per hub — added with the five new hubs so the Passport stays
  // complete. `unlockBadgeForHub` silently no-ops on an unmapped hub, so a
  // missing entry here would be an invisible dead end rather than an error.
  { id: 'bazaar-navigator', emoji: '🧭', name: 'Bazaar Navigator', description: 'Find your way through 3 covered markets.', earned: false, progress: 0 },
  { id: 'pasaj-explorer', emoji: '🎭', name: 'Pasaj Explorer', description: 'Duck into 4 İstiklal arcades and side streets.', earned: false, progress: 0 },
  { id: 'bogaz-walker', emoji: '🌊', name: 'Boğaz Walker', description: 'Walk 3 stretches of the Bosphorus shoreline.', earned: false, progress: 0 },
  { id: 'hill-climber', emoji: '⛰️', name: 'Hill Climber', description: 'Reach 3 hilltop views on the Asian side.', earned: false, progress: 0 },
  { id: 'island-hopper', emoji: '🏝️', name: 'Island Hopper', description: 'Set foot on 2 of the Princes’ Islands.', earned: false, progress: 0 },
];

export const PAST_TRIPS: PastTrip[] = [
  { id: 'p1', title: 'Old City monuments', hub: 'sultanahmet', date: '2026-06-14', distanceKm: 2.8, stops: 6, spentTry: 4300 },
  { id: 'p2', title: 'Galata & coffee', hub: 'karakoy-galata', date: '2026-06-16', distanceKm: 1.6, stops: 4, spentTry: 1850 },
  { id: 'p3', title: 'Kadıköy food crawl', hub: 'kadikoy-moda', date: '2026-06-19', distanceKm: 2.1, stops: 5, spentTry: 2100 },
];

export const PROFILE_STATS: ProfileStats = {
  totalKm: 6.5,
  stopsVisited: 15,
  spentTry: 8250,
};

// ── Tours (GetYourGuide / TripAdvisor shaped) ──────────────────────
// affiliateUrl is a mock partner link (?ref=pathwise). isSponsored → badged,
// surfaced to the top of the list, and hidden for premium (ad-free) users.
export const CURATED_TOURS: Tour[] = [
  { id: 'tour1', title: 'Imperial Istanbul: Old City Highlights', hub: 'sultanahmet', source: 'Pathwise', durationHours: 6, priceTry: 1900, rating: 4.8, stopNames: ['Hagia Sophia', 'Blue Mosque', 'Topkapı Palace', 'Grand Bazaar'], live: false, affiliateUrl: 'https://partners.pathwise.mock/book/tour1?ref=pathwise', isSponsored: true },
  { id: 'tour2', title: 'Bosphorus & Palaces Afternoon', hub: 'besiktas-bogaz', source: 'Pathwise', durationHours: 5, priceTry: 1650, rating: 4.6, stopNames: ['Dolmabahçe Palace', 'Ortaköy Mosque', 'Bebek Seaside'], live: false, affiliateUrl: 'https://partners.pathwise.mock/book/tour2?ref=pathwise', isSponsored: false },
  { id: 'tour3', title: 'Balat Photo Walk', hub: 'balat-fener', source: 'Pathwise', durationHours: 3, priceTry: 900, rating: 4.7, stopNames: ['Colorful Houses', 'Fener Patriarchate', 'Antique Shops'], live: false, affiliateUrl: 'https://partners.pathwise.mock/book/tour3?ref=pathwise', isSponsored: false },
  { id: 'tour4', title: 'Kadıköy Market & Meze Evening', hub: 'kadikoy-moda', source: 'Pathwise', durationHours: 4, priceTry: 1250, rating: 4.7, stopNames: ['Kadıköy Market', 'Pickle row', 'Çiya Sofrası', 'Moda Pier'], live: false, affiliateUrl: 'https://partners.pathwise.mock/book/tour4?ref=pathwise', isSponsored: false },
  { id: 'tour5', title: 'Galata After Dark: Rooftops & Meyhane', hub: 'karakoy-galata', source: 'Pathwise', durationHours: 4, priceTry: 1400, rating: 4.5, stopNames: ['Galata Tower', 'Serdar-ı Ekrem', 'Nevizade meyhane'], live: false, affiliateUrl: 'https://partners.pathwise.mock/book/tour5?ref=pathwise', isSponsored: false },
  { id: 'tour6', title: 'Old City on a Budget (Walking Only)', hub: 'sultanahmet', source: 'Pathwise', durationHours: 4, priceTry: 550, rating: 4.4, stopNames: ['Hippodrome', 'Blue Mosque courtyard', 'Spice Bazaar', 'Gülhane Park'], live: false, affiliateUrl: 'https://partners.pathwise.mock/book/tour6?ref=pathwise', isSponsored: false },
];

// Returned by "🔄 Sync Live Tours" — pretends to sync from partner APIs.
export const LIVE_TOURS: Tour[] = [
  { id: 'live1', title: 'Sunset Bosphorus Cruise (Small Group)', hub: 'besiktas-bogaz', source: 'GetYourGuide', durationHours: 2, priceTry: 1200, rating: 4.9, stopNames: ['Ortaköy', 'Bebek', 'Rumeli Hisarı'], live: true, affiliateUrl: 'https://www.getyourguide.com/mock/live1?ref=pathwise', isSponsored: true },
  { id: 'live2', title: 'Street Food Tour of Kadıköy', hub: 'kadikoy-moda', source: 'TripAdvisor', durationHours: 4, priceTry: 1450, rating: 4.8, stopNames: ['Çarşı', 'Çiya Sofrası', 'Ali Usta', 'Fish sandwich pier'], live: true, affiliateUrl: 'https://www.tripadvisor.com/mock/live2?ref=pathwise', isSponsored: false },
  { id: 'live3', title: 'Hidden Galata Coffee & Baklava', hub: 'karakoy-galata', source: 'GetYourGuide', durationHours: 3, priceTry: 1100, rating: 4.7, stopNames: ['Karaköy Güllüoğlu', 'SALT Galata', 'Galata Tower'], live: true, affiliateUrl: 'https://www.getyourguide.com/mock/live3?ref=pathwise', isSponsored: false },
  { id: 'live4', title: 'Balat & Fener Photo Safari', hub: 'balat-fener', source: 'TripAdvisor', durationHours: 3, priceTry: 950, rating: 4.6, stopNames: ['Merdivenli Yokuş', 'Fener Greek School', 'Ayvansaray shoreline'], live: true, affiliateUrl: 'https://www.tripadvisor.com/mock/live4?ref=pathwise', isSponsored: false },
  { id: 'live5', title: 'Sultanahmet Early-Bird, Skip-the-Line', hub: 'sultanahmet', source: 'GetYourGuide', durationHours: 3, priceTry: 1750, rating: 4.8, stopNames: ['Hagia Sophia', 'Basilica Cistern', 'Topkapı Palace'], live: true, affiliateUrl: 'https://www.getyourguide.com/mock/live5?ref=pathwise', isSponsored: false },
];

// ── City Survival & Etiquette widget ───────────────────────────────
export interface SurvivalCategory {
  id: string;
  icon: string;
  title: string;
  tips: string[];
}
export const SURVIVAL_GUIDE: SurvivalCategory[] = [
  {
    id: 'transit',
    icon: '🚇',
    title: 'Transit Hacks',
    tips: [
      'Buy an Istanbulkart at any kiosk — one card taps for metro, tram, ferry and bus, and transfers are discounted.',
      'Marmaray tunnels under the Bosphorus: Sirkeci → Ayrılık Çeşmesi in ~4 min, cheaper than a ferry when it rains.',
      'Prefer BiTaksi/Uber over hailing street taxis — the app fixes the meter and route.',
    ],
  },
  {
    id: 'etiquette',
    icon: '🕌',
    title: 'Etiquette & Dress Code',
    tips: [
      'Mosques: cover shoulders & knees, women bring a scarf, remove shoes. Avoid visiting during the 5 daily prayers.',
      'Ask before photographing people, especially at prayer. No flash inside mosques.',
      'Tipping (~10%) is normal in restaurants; round up for taxis and çay.',
    ],
  },
  {
    id: 'museum',
    icon: '🎟️',
    title: 'Museum & Pass Guide',
    tips: [
      'Buy e-tickets in advance to skip the Hagia Sophia / Topkapı queues.',
      'The Istanbul Museum Pass (5 days) pays off if you visit 3+ covered sites.',
      'Topkapı closes Tuesdays; Dolmabahçe closes Mondays — plan around it.',
    ],
  },
  {
    id: 'safety',
    icon: '🚨',
    title: 'Emergency & Safety',
    tips: [
      'Emergency line: 112 (single number for medical, police, fire).',
      'Beşiktaş, Kadıköy, Moda and Cihangir are lively and safe late; keep to lit main streets.',
      'Solo women: the front carriage of the metro is generally quieter; night ferries are well-lit and staffed.',
    ],
  },
];

// ── Tourist police stations (SOS / safety, Phase 2) ────────────────
// Shaped like IBB Open Data / Emniyet directory; used to find the nearest one.
export interface PoliceStation {
  name: string;
  lat: number;
  lng: number;
  phone: string;
}
export const EMERGENCY_NUMBER = '112'; // Turkey single emergency line
export const POLICE_STATIONS: PoliceStation[] = [
  { name: 'Sultanahmet Tourist Police', lat: 41.0058, lng: 28.9769, phone: '+90 212 527 4503' },
  { name: 'Taksim Tourist Police', lat: 41.0369, lng: 28.9857, phone: '+90 212 245 0912' },
  { name: 'Kadıköy Police Station', lat: 40.9903, lng: 29.0253, phone: '+90 216 349 0837' },
  { name: 'Beşiktaş Police Station', lat: 41.0426, lng: 29.0056, phone: '+90 212 236 1616' },
  { name: 'Beyoğlu (Galata) Police', lat: 41.0256, lng: 28.9741, phone: '+90 212 251 8748' },
];

// ── Must-visit bucket list (subset of places) ──────────────────────
export const BUCKET_LIST_IDS: string[] = [
  'ChIJ-galata-tower',
  'ChIJ-sultanahmet-basilicacistern',
  'ChIJ-sultanahmet-hagiasophia',
  'ChIJ-sultanahmet-topkapi',
  'ChIJ-kadikoy-carsi',
  'ChIJ-besiktas-ortakoy-mosque',
  'ChIJ-balat-colorfulhouses',
  'ChIJ-sultanahmet-grandbazaar',
];
