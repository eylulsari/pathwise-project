import type {
  Badge,
  CheckInSeed,
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
    preferredHubs: ['karakoy-galata', 'balat-fener'],
    budgetLevel: 'mid',
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
    preferredHubs: ['kadikoy-moda', 'besiktas-bogaz'],
    budgetLevel: 'budget',
    // No declaration — stays out of the women-traveler list.
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
    preferredHubs: ['sultanahmet', 'balat-fener'],
    budgetLevel: 'budget',
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
    preferredHubs: ['kadikoy-moda', 'sultanahmet'],
    budgetLevel: 'mid',
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
    preferredHubs: ['kadikoy-moda', 'karakoy-galata'],
    budgetLevel: 'budget',
    // No declaration.
  },
  {
    id: 't6',
    name: 'Sofia Marchetti',
    age: 33,
    nationality: 'Italy',
    avatarColor: '#A8574C',
    tags: ['#Foodie', '#CultureSeeker'],
    bio: 'Restoring frescoes back home. Here to argue that Istanbul does breakfast better than Rome.',
    soloVerified: true,
    visitedProvinces: ['İstanbul', 'Konya', 'Hatay'],
    badges: ['old-city-master', 'kahve-guru'],
    preferredHubs: ['sultanahmet', 'karakoy-galata'],
    budgetLevel: 'comfort',
    identifiesAsWoman: true,
  },
  {
    id: 't7',
    name: 'Noah Weber',
    age: 28,
    nationality: 'Germany',
    avatarColor: '#5B7A99',
    tags: ['#Backpacker', '#PhotoNomad'],
    bio: 'Shooting film only, 36 frames a day. Balat eats most of them.',
    soloVerified: false,
    visitedProvinces: ['İstanbul', 'Eskişehir'],
    badges: [],
    preferredHubs: ['balat-fener', 'kadikoy-moda'],
    budgetLevel: 'budget',
    // No declaration.
  },
  {
    id: 't8',
    name: 'Priya Raghunathan',
    age: 30,
    nationality: 'India',
    avatarColor: '#7C6A9C',
    tags: ['#CultureSeeker', '#SlowTravel'],
    bio: 'Two weeks, four museums, zero rushing. Ask me about the Museum Pass maths.',
    soloVerified: true,
    visitedProvinces: ['İstanbul', 'İzmir', 'Denizli'],
    badges: ['old-city-master'],
    preferredHubs: ['sultanahmet', 'besiktas-bogaz'],
    budgetLevel: 'mid',
    identifiesAsWoman: true,
  },
  {
    id: 't9',
    name: 'Tom Whitaker',
    age: 35,
    nationality: 'United Kingdom',
    avatarColor: '#4F7C5E',
    tags: ['#SoloVerified', '#Foodie'],
    bio: 'Third trip this year. Working my way along the Bosphorus one fish restaurant at a time.',
    soloVerified: true,
    visitedProvinces: ['İstanbul', 'Muğla', 'Antalya'],
    badges: ['ferry-hopper', 'kahve-guru'],
    preferredHubs: ['besiktas-bogaz', 'karakoy-galata'],
    budgetLevel: 'comfort',
    // No declaration.
  },
  {
    id: 't10',
    name: 'Elif Şahin',
    age: 25,
    nationality: 'Türkiye',
    avatarColor: '#C98A3E',
    tags: ['#SoloVerified', '#PhotoNomad', '#Foodie'],
    bio: 'Kadıköy local. Happy to show you the streets the guidebooks skip.',
    soloVerified: true,
    visitedProvinces: ['İstanbul', 'Çanakkale', 'Sinop', 'Ordu'],
    badges: ['kahve-guru', 'ferry-hopper'],
    preferredHubs: ['kadikoy-moda', 'balat-fener'],
    budgetLevel: 'budget',
    identifiesAsWoman: true,
  },
  {
    id: 't11',
    name: 'Marcus Andersen',
    age: 41,
    nationality: 'Denmark',
    avatarColor: '#3E6B77',
    tags: ['#SlowTravel', '#CultureSeeker'],
    bio: 'One neighbourhood per trip. This one is Balat and I am not done with it.',
    soloVerified: false,
    visitedProvinces: ['İstanbul', 'Bursa'],
    badges: ['old-city-master'],
    preferredHubs: ['balat-fener', 'sultanahmet'],
    budgetLevel: 'comfort',
    // No declaration.
  },
  {
    id: 't12',
    name: 'Camila Rojas',
    age: 27,
    nationality: 'Colombia',
    avatarColor: '#B85C7A',
    tags: ['#Backpacker', '#Foodie'],
    bio: 'Hostel-hopping across the Balkans. Istanbul was meant to be three days, it has been three weeks.',
    soloVerified: true,
    visitedProvinces: ['İstanbul', 'Edirne'],
    badges: [],
    preferredHubs: ['kadikoy-moda', 'karakoy-galata'],
    budgetLevel: 'budget',
    identifiesAsWoman: true,
  },
  {
    id: 't13',
    name: 'Hana Kovač',
    age: 32,
    nationality: 'Croatia',
    avatarColor: '#6B8E8A',
    tags: ['#PhotoNomad', '#SlowTravel'],
    bio: 'Ferry commuter by choice. Best light in this city is from the water.',
    soloVerified: true,
    visitedProvinces: ['İstanbul', 'İzmir'],
    badges: ['ferry-hopper'],
    preferredHubs: ['karakoy-galata', 'besiktas-bogaz'],
    budgetLevel: 'mid',
    identifiesAsWoman: true,
  },
  {
    id: 't14',
    name: 'Kenji Mori',
    age: 38,
    nationality: 'Japan',
    avatarColor: '#8A6B4F',
    tags: ['#SoloVerified', '#CultureSeeker', '#PhotoNomad'],
    bio: 'Calligrapher. Came for the Ottoman archives, stayed for the tea gardens.',
    soloVerified: true,
    visitedProvinces: ['İstanbul', 'Konya', 'Nevşehir'],
    badges: ['old-city-master', 'kahve-guru'],
    preferredHubs: ['sultanahmet', 'karakoy-galata'],
    budgetLevel: 'comfort',
    // No declaration.
  },
];

/**
 * Check-in feed.
 *
 * Authored as "how long ago", then given a real `createdAt` when served (see
 * `api.getCheckIns`). The stored minute count is the source of truth for the
 * *shape* of the feed — a spread from minutes to hours old — while the
 * timestamp is computed relative to now, so the feed never looks stale and
 * anything that reasons about time (how recently someone was here) has a real
 * instant to work with instead of a frozen integer.
 *
 * The spread is deliberate: entries under ~2h old, a cluster either side of
 * that mark, and clearly old ones, so a "still around / long gone" distinction
 * has something to distinguish.
 */
export const CHECK_INS: CheckInSeed[] = [
  { id: 'c1', traveler: { id: 't1', name: 'Mara Lindqvist', avatarColor: '#4A7C82' }, placeName: 'Galata Tower', hub: 'karakoy-galata', message: 'Golden hour is unreal up here 🌇', minutesAgo: 8 },
  { id: 'c2', traveler: { id: 't2', name: 'Diego Fernández', avatarColor: '#C56F52' }, placeName: 'Çiya Sofrası', hub: 'kadikoy-moda', message: 'Anyone want to split a table? So much food.', minutesAgo: 21 },
  { id: 'c3', traveler: { id: 't4', name: 'Amara Okafor', avatarColor: '#B5654A' }, placeName: 'Kadıköy Market', hub: 'kadikoy-moda', message: 'Pickle shop tour starting now 🥒', minutesAgo: 34 },
  { id: 'c8', traveler: { id: 't10', name: 'Elif Şahin', avatarColor: '#C98A3E' }, placeName: 'Moda Sahili', hub: 'kadikoy-moda', message: 'Çay ve simit, sahilde. Yerliyim, soru sorabilirsiniz ☕', minutesAgo: 41 },
  { id: 'c4', traveler: { id: 't3', name: 'Yuki Tanaka', avatarColor: '#6E8F74' }, placeName: 'Balat Colorful Houses', hub: 'balat-fener', message: 'Sketching the terraces, come say hi.', minutesAgo: 52 },
  { id: 'c9', traveler: { id: 't9', name: 'Tom Whitaker', avatarColor: '#4F7C5E' }, placeName: 'Ortaköy Sahili', hub: 'besiktas-bogaz', message: 'Bridge view table just opened up, two seats free 🌉', minutesAgo: 58 },
  { id: 'c5', traveler: { id: 't5', name: 'Liam O’Connor', avatarColor: '#3F6E8C' }, placeName: 'Moda Pier', hub: 'kadikoy-moda', message: 'End of the deck, 270° of water. Staying for sunset ⚓', minutesAgo: 66 },
  { id: 'c10', traveler: { id: 't7', name: 'Noah Weber', avatarColor: '#5B7A99' }, placeName: 'Fener Greek School', hub: 'balat-fener', message: 'Last two frames on this roll. Red brick against grey sky, worth the walk up.', minutesAgo: 95 },
  { id: 'c11', traveler: { id: 't6', name: 'Sofia Marchetti', avatarColor: '#A8574C' }, placeName: 'Hagia Sophia', hub: 'sultanahmet', message: 'Queue is twenty minutes at this hour, not the two you read about.', minutesAgo: 112 },
  { id: 'c6', traveler: { id: 't1', name: 'Mara Lindqvist', avatarColor: '#4A7C82' }, placeName: 'Spice Bazaar', hub: 'sultanahmet', message: 'Bought saffron on Hasırcılar instead of inside — half the price 🌶️', minutesAgo: 128 },
  { id: 'c12', traveler: { id: 't12', name: 'Camila Rojas', avatarColor: '#B85C7A' }, placeName: 'Karaköy Lokantası', hub: 'karakoy-galata', message: 'Lunch menu is the cheap way into this place. Gone now, but go.', minutesAgo: 155 },
  { id: 'c7', traveler: { id: 't4', name: 'Amara Okafor', avatarColor: '#B5654A' }, placeName: 'Yeldeğirmeni Murals', hub: 'kadikoy-moda', message: 'Following the mural trail street by street, it just keeps going 🎨', minutesAgo: 184 },
  { id: 'c13', traveler: { id: 't14', name: 'Kenji Mori', avatarColor: '#8A6B4F' }, placeName: 'Süleymaniye Mosque', hub: 'sultanahmet', message: 'Courtyard was empty at opening. Headed back to the tea garden now.', minutesAgo: 240 },
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
      { authorName: 'Amara O.', text: 'Worth checking what it actually covers first — the Basilica Cistern is run separately and is not included, so budget that ticket on top.', minutesAgo: 6 },
      { authorName: 'Mara L.', text: 'It is valid 5 days from first use, so a 2-day trip wastes most of it unless you go hard on the Sultanahmet museums both days.', minutesAgo: 4 },
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
      { authorName: 'Selin K.', text: 'If you are already on the Asian side you rarely need any of that — Kadife Sk. to most of Moda is a 15-min walk on lit, busy streets.', minutesAgo: 21 },
    ],
  },
  {
    id: 'q3',
    authorName: 'Hannah (Germany)',
    question: 'How much cash should I carry? Is card accepted everywhere?',
    minutesAgo: 95,
    answers: [
      { authorName: 'Diego F.', text: 'Card works almost everywhere including tiny cafés. Keep ~500₺ cash for market stalls, the kumpir row and street simit.', minutesAgo: 80 },
      { authorName: 'Yuki T.', text: 'Skip the airport exchange booths — the rate is far better at the döviz offices in Eminönü or Kadıköy.', minutesAgo: 74 },
    ],
  },
  {
    id: 'q4',
    authorName: 'Marco (Italy)',
    question: 'Istanbulkart — one card for two people, or one each?',
    minutesAgo: 150,
    answers: [
      { authorName: 'Selin K.', text: 'One card can pay for several people — just tap once per person at the turnstile. Buy it from the machines at any metro or ferry entrance.', minutesAgo: 141 },
      { authorName: 'Amara O.', text: 'It covers ferries, tram, metro, funicular and buses, and transfers within two hours are discounted, so it pays for itself on day one.', minutesAgo: 132 },
    ],
  },
  {
    id: 'q5',
    authorName: 'Chen (Singapore)',
    question: 'Rainy day in Istanbul — what actually stays good in the wet?',
    minutesAgo: 210,
    answers: [
      { authorName: 'Mara L.', text: 'Basilica Cistern and the Museum of Turkish & Islamic Arts are both fully indoors and two minutes apart on the Hippodrome.', minutesAgo: 198 },
      { authorName: 'Tom (UK)', text: 'The Grand Bazaar and Spice Bazaar are covered too — a wet afternoon is honestly the best time to go, far fewer people.', minutesAgo: 190 },
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
