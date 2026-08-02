import type {
  Badge,
  CheckIn,
  CommunityRoute,
  ForumQuestion,
  PastTrip,
  ProfileStats,
  Tour,
  Traveler,
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

// ── Travelers (buddy network) ──────────────────────────────────────
// Offline fallback for `GET /social/travelers` — kept in sync with the backend
// seed in `modules/social/infrastructure/persistence/traveler.dataset.ts`.
//
// ⚠️ `identifiesAsWoman` below is DEMO SEED DATA, hand-assigned on purpose. It
// is NOT inferred from names, avatars or any other attribute — this product
// never guesses gender. In production the value only ever comes from the
// account holder ticking the opt-in box themselves, and it is never verified.
// Travelers who have stated nothing simply omit the field.
export const TRAVELERS: Traveler[] = [
  {
    id: 't1',
    name: 'Mara Lindqvist',
    age: 27,
    nationality: 'Sweden',
    avatarColor: '#4A7C82',
    tags: ['#SoloVerified', '#PhotoNomad', '#CultureSeeker'],
    bio: 'Slow-traveling photographer chasing golden hour across the Bosphorus.',
    soloVerified: true,
    visitedProvinces: ['İstanbul', 'İzmir', 'Antalya', 'Nevşehir'],
    badges: ['old-city-master', 'ferry-hopper'],
    identifiesAsWoman: true,
  },
  {
    id: 't2',
    name: 'Diego Fernández',
    age: 31,
    nationality: 'Spain',
    avatarColor: '#C56F52',
    tags: ['#Foodie', '#Backpacker'],
    bio: 'Here for the meyhanes and the meze. Will travel for good rakı.',
    soloVerified: true,
    visitedProvinces: ['İstanbul', 'Çanakkale', 'Muğla'],
    badges: ['kahve-guru'],
  },
  {
    id: 't3',
    name: 'Yuki Tanaka',
    age: 24,
    nationality: 'Japan',
    avatarColor: '#6E8F74',
    tags: ['#SoloVerified', '#CultureSeeker', '#SlowTravel'],
    bio: 'Architecture student mapping every Sinan mosque in the city.',
    soloVerified: true,
    visitedProvinces: ['İstanbul', 'Edirne', 'Bursa'],
    badges: ['old-city-master'],
    identifiesAsWoman: true,
  },
  {
    id: 't4',
    name: 'Amara Okafor',
    age: 29,
    nationality: 'Nigeria',
    avatarColor: '#B5654A',
    tags: ['#Foodie', '#PhotoNomad'],
    bio: 'Food writer collecting street-food stories one simit at a time.',
    soloVerified: false,
    visitedProvinces: ['İstanbul', 'Gaziantep'],
    badges: ['kahve-guru', 'ferry-hopper'],
    identifiesAsWoman: true,
  },
  {
    id: 't5',
    name: 'Liam O’Connor',
    age: 26,
    nationality: 'Ireland',
    avatarColor: '#3F6E8C',
    tags: ['#Backpacker', '#SlowTravel'],
    bio: 'Six months overland from Dublin to Istanbul. Not stopping yet.',
    soloVerified: true,
    visitedProvinces: ['İstanbul', 'Kars', 'Trabzon'],
    badges: [],
  },
];

export const CHECK_INS: CheckIn[] = [
  { id: 'c1', traveler: { id: 't1', name: 'Mara Lindqvist', avatarColor: '#4A7C82' }, placeName: 'Galata Tower', hub: 'karakoy-galata', message: 'Golden hour is unreal up here 🌇', minutesAgo: 8 },
  { id: 'c2', traveler: { id: 't2', name: 'Diego Fernández', avatarColor: '#C56F52' }, placeName: 'Çiya Sofrası', hub: 'kadikoy-moda', message: 'Anyone want to split a table? So much food.', minutesAgo: 21 },
  { id: 'c3', traveler: { id: 't4', name: 'Amara Okafor', avatarColor: '#B5654A' }, placeName: 'Kadıköy Market', hub: 'kadikoy-moda', message: 'Pickle shop tour starting now 🥒', minutesAgo: 34 },
  { id: 'c4', traveler: { id: 't3', name: 'Yuki Tanaka', avatarColor: '#6E8F74' }, placeName: 'Balat Colorful Houses', hub: 'balat-fener', message: 'Sketching the terraces, come say hi.', minutesAgo: 52 },
];

export const COMMUNITY_ROUTES: CommunityRoute[] = [
  { id: 'r1', title: 'Asian-side food crawl', authorName: 'Diego F.', hub: 'kadikoy-moda', stops: 5, distanceKm: 2.1, likes: 128, liked: false, tags: ['food', 'market'] },
  { id: 'r2', title: 'Galata golden-hour loop', authorName: 'Mara L.', hub: 'karakoy-galata', stops: 4, distanceKm: 1.6, likes: 96, liked: false, tags: ['photo', 'history'] },
  { id: 'r3', title: 'Balat rainbow morning', authorName: 'Yuki T.', hub: 'balat-fener', stops: 5, distanceKm: 1.9, likes: 74, liked: false, tags: ['photo', 'art'] },
  { id: 'r4', title: 'Old City in one day', authorName: 'Amara O.', hub: 'sultanahmet', stops: 6, distanceKm: 2.8, likes: 203, liked: false, tags: ['history', 'photo'] },
];

export const FORUM_QUESTIONS: ForumQuestion[] = [
  {
    id: 'q1',
    authorName: 'Priya (India)',
    question: 'Is the Museum Pass worth it for just 2 days in Sultanahmet?',
    minutesAgo: 12,
    answers: [
      { authorName: 'Yuki T.', text: 'Yes if you hit Hagia Sophia + Topkapı + one more. Skips the queues too.', minutesAgo: 9 },
    ],
  },
  {
    id: 'q2',
    authorName: 'Tom (UK)',
    question: 'Safest way back to Kadıköy after midnight from the bars?',
    minutesAgo: 40,
    answers: [
      { authorName: 'Diego F.', text: 'Night ferries stop ~midnight; after that use BiTaksi, not street taxis.', minutesAgo: 33 },
      { authorName: 'Mara L.', text: 'Marmaray runs late on weekends — check the last train time.', minutesAgo: 28 },
    ],
  },
];

// ── Profile ────────────────────────────────────────────────────────
export const BADGES: Badge[] = [
  { id: 'old-city-master', emoji: '🕌', name: 'Old City Master', description: 'Visit 5 monuments in Sultanahmet.', earned: true, progress: 100 },
  { id: 'ferry-hopper', emoji: '🚢', name: 'Ferry Hopper', description: 'Cross the Bosphorus by ferry 3 times.', earned: true, progress: 100 },
  { id: 'kahve-guru', emoji: '☕', name: 'Kahve Guru', description: 'Try Turkish coffee at 4 different spots.', earned: false, progress: 75 },
  { id: 'market-forager', emoji: '🧺', name: 'Market Forager', description: 'Explore 3 neighborhood markets.', earned: false, progress: 66 },
  { id: 'sunset-chaser', emoji: '🌅', name: 'Sunset Chaser', description: 'Catch golden hour at 5 viewpoints.', earned: false, progress: 40 },
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
];

// Returned by "🔄 Sync Live Tours" — pretends to sync from partner APIs.
export const LIVE_TOURS: Tour[] = [
  { id: 'live1', title: 'Sunset Bosphorus Cruise (Small Group)', hub: 'besiktas-bogaz', source: 'GetYourGuide', durationHours: 2, priceTry: 1200, rating: 4.9, stopNames: ['Ortaköy', 'Bebek', 'Rumeli Hisarı'], live: true, affiliateUrl: 'https://www.getyourguide.com/mock/live1?ref=pathwise', isSponsored: true },
  { id: 'live2', title: 'Street Food Tour of Kadıköy', hub: 'kadikoy-moda', source: 'TripAdvisor', durationHours: 4, priceTry: 1450, rating: 4.8, stopNames: ['Çarşı', 'Çiya Sofrası', 'Ali Usta', 'Fish sandwich pier'], live: true, affiliateUrl: 'https://www.tripadvisor.com/mock/live2?ref=pathwise', isSponsored: false },
  { id: 'live3', title: 'Hidden Galata Coffee & Baklava', hub: 'karakoy-galata', source: 'GetYourGuide', durationHours: 3, priceTry: 1100, rating: 4.7, stopNames: ['Karaköy Güllüoğlu', 'SALT Galata', 'Galata Tower'], live: true, affiliateUrl: 'https://www.getyourguide.com/mock/live3?ref=pathwise', isSponsored: false },
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
