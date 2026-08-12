import { Traveler } from '../../domain/traveler';

/**
 * Curated demo traveler seed — mirrors the frontend `TRAVELERS` mock so the
 * buddy list can be served from the API. A real build would read these from a
 * `travelers`/`users` join; this module keeps the same shape so that swap is
 * local to the repository.
 *
 * ⚠️ `identifiesAsWoman` below is DEMO SEED DATA, deliberately hand-assigned.
 * It is NOT inferred from names, avatars, or any other attribute — inferring
 * gender from a name is unreliable and not something this product does. In
 * production this value only ever comes from the account holder ticking the
 * opt-in box themselves (see `User.identifiesAsWoman`), and it is never
 * verified. Travelers who have not stated anything simply omit the field.
 *
 * ── Why twenty-four, and why this spread ─────────────────────────────
 * Buddy matching (Görev 2) ranks this list, and a ranking over five people —
 * three of whom are visible by default — cannot show anything. The seed is
 * built to exercise the scorer rather than to look busy:
 *
 *  - all TEN hubs appear as a preferred hub for at least two travelers, so a
 *    user's trip history actually separates the list;
 *  - all three budget levels are represented, so budget is not accidentally a
 *    proxy for neighbourhood;
 *  - every one of the six tags appears on at least three travelers, so no
 *    style filter lands on an empty (or single-result) list;
 *  - `#SoloVerified` is spread across declarations so it never reads as a
 *    women-only or men-only marker.
 *
 * The first three are asserted in `social.service.spec.ts`, and the hub one
 * reads its list from `HUB_DATASET` rather than restating it — when the app
 * went from five hubs to ten, a hand-copied list in the test meant the gap
 * went unnoticed while the suite stayed green.
 *
 * Thirteen travelers have made a women-traveler declaration and five of those
 * chose women-only visibility, which keeps both sides of the reciprocity rule
 * testable: a browsing account sees nineteen, an opted-in one sees all
 * twenty-four. (Verified against the running API, not counted by eye.)
 */
export const TRAVELER_SEED: Traveler[] = [
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
    visibleToWomenOnly: false,
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
    // Opted into being discoverable only by other women travelers: this
    // traveler disappears from the default list entirely.
    visibleToWomenOnly: true,
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
    visibleToWomenOnly: false,
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
    visibleToWomenOnly: false,
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
    visibleToWomenOnly: true,
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
    visibleToWomenOnly: false,
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
    visibleToWomenOnly: false,
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
    visibleToWomenOnly: true,
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

  // ── Added with the 10-hub expansion ──────────────────────────────
  // The first fourteen only ever named the original five hubs, so once the
  // app grew to ten the matcher's hub component scored 0 for anyone whose
  // trips were in Eminönü, Beyoğlu, Ortaköy, Üsküdar or the islands — the
  // ranking quietly fell back to style and budget alone. These ten give every
  // new hub at least three travelers. Existing records are untouched: their
  // profiles are what the current match percentages are built on.
  {
    id: 't15',
    name: 'Zeynep Aydın',
    age: 29,
    nationality: 'Türkiye',
    avatarColor: '#B0603A',
    tags: ['#CultureSeeker', '#SlowTravel'],
    bio: 'Grew up two streets from the Spice Bazaar. Will argue about baklava.',
    soloVerified: true,
    visitedProvinces: ['İstanbul', 'Gaziantep', 'Mardin'],
    badges: ['bazaar-navigator', 'old-city-master'],
    preferredHubs: ['eminonu-sirkeci', 'sultanahmet'],
    budgetLevel: 'mid',
    identifiesAsWoman: true,
    visibleToWomenOnly: false,
  },
  {
    id: 't16',
    name: 'Ravi Menon',
    age: 34,
    nationality: 'India',
    avatarColor: '#7A5C9E',
    tags: ['#Foodie', '#Backpacker'],
    bio: 'Eating his way up from Eminönü to Taksim, one street cart at a time.',
    soloVerified: false,
    visitedProvinces: ['İstanbul', 'İzmir'],
    badges: ['bazaar-navigator'],
    preferredHubs: ['eminonu-sirkeci', 'beyoglu-taksim'],
    budgetLevel: 'budget',
    // No declaration.
  },
  {
    id: 't17',
    name: 'Sofia Novak',
    age: 26,
    nationality: 'Czechia',
    avatarColor: '#C97B8E',
    tags: ['#PhotoNomad', '#SoloVerified'],
    bio: 'Shoots the arcades off İstiklal before the shutters go up.',
    soloVerified: true,
    visitedProvinces: ['İstanbul', 'Çanakkale'],
    badges: ['pasaj-explorer'],
    preferredHubs: ['beyoglu-taksim', 'karakoy-galata'],
    budgetLevel: 'mid',
    identifiesAsWoman: true,
    visibleToWomenOnly: true,
  },
  {
    id: 't18',
    name: 'Arda Kılıç',
    age: 24,
    nationality: 'Türkiye',
    avatarColor: '#4F7C5E',
    tags: ['#Backpacker', '#Foodie'],
    bio: 'Student rate: ferry, çay, meyhane, repeat. Knows every free view.',
    soloVerified: false,
    visitedProvinces: ['İstanbul', 'Eskişehir', 'Bursa'],
    badges: ['pasaj-explorer', 'market-forager'],
    preferredHubs: ['beyoglu-taksim', 'kadikoy-moda'],
    budgetLevel: 'budget',
    // No declaration.
  },
  {
    id: 't19',
    name: 'Noor Haddad',
    age: 31,
    nationality: 'Jordan',
    avatarColor: '#6B8E5A',
    tags: ['#CultureSeeker', '#SlowTravel'],
    bio: 'Mosque architecture, slowly. Üsküdar mornings, Eminönü afternoons.',
    soloVerified: true,
    visitedProvinces: ['İstanbul', 'Konya', 'Şanlıurfa'],
    badges: ['hill-climber'],
    preferredHubs: ['uskudar', 'eminonu-sirkeci'],
    budgetLevel: 'mid',
    identifiesAsWoman: true,
    visibleToWomenOnly: false,
  },
  {
    id: 't20',
    name: 'Erik Bauer',
    age: 38,
    nationality: 'Germany',
    avatarColor: '#3E7BA6',
    tags: ['#SlowTravel', '#PhotoNomad'],
    bio: 'Walks the Bosphorus shore end to end and photographs the ferries.',
    soloVerified: true,
    visitedProvinces: ['İstanbul', 'Antalya'],
    badges: ['bogaz-walker', 'hill-climber'],
    preferredHubs: ['uskudar', 'ortakoy-bebek'],
    budgetLevel: 'comfort',
    // No declaration.
  },
  {
    id: 't21',
    name: 'Leyla Demirci',
    age: 27,
    nationality: 'Türkiye',
    avatarColor: '#A87F28',
    tags: ['#PhotoNomad', '#CultureSeeker'],
    bio: 'Çamlıca at dawn, Büyükada by the afternoon ferry. Film only.',
    soloVerified: true,
    visitedProvinces: ['İstanbul', 'Sinop', 'Trabzon'],
    badges: ['hill-climber', 'island-hopper'],
    preferredHubs: ['uskudar', 'adalar'],
    budgetLevel: 'budget',
    identifiesAsWoman: true,
    visibleToWomenOnly: false,
  },
  {
    id: 't22',
    name: 'Grace Mbeki',
    age: 33,
    nationality: 'Kenya',
    avatarColor: '#2E8B87',
    tags: ['#SlowTravel', '#SoloVerified'],
    bio: 'One island per weekend. No cars, no rush, a book and a pine tree.',
    soloVerified: true,
    visitedProvinces: ['İstanbul', 'Muğla'],
    badges: ['island-hopper', 'bogaz-walker'],
    preferredHubs: ['adalar', 'ortakoy-bebek'],
    budgetLevel: 'comfort',
    identifiesAsWoman: true,
    visibleToWomenOnly: true,
  },
  {
    id: 't23',
    name: 'Paolo Ricci',
    age: 41,
    nationality: 'Italy',
    avatarColor: '#C56F52',
    tags: ['#Foodie', '#SlowTravel'],
    bio: 'Came for the fish restaurants on the islands, stayed for the ferries.',
    soloVerified: false,
    visitedProvinces: ['İstanbul', 'İzmir', 'Çanakkale'],
    badges: ['island-hopper', 'ferry-hopper'],
    preferredHubs: ['adalar', 'besiktas-bogaz'],
    budgetLevel: 'comfort',
    // No declaration.
  },
  {
    id: 't24',
    name: 'Mei Chen',
    age: 28,
    nationality: 'Taiwan',
    avatarColor: '#5E8C74',
    tags: ['#PhotoNomad', '#SoloVerified'],
    bio: 'Waterside mosques at blue hour. Ortaköy first, then the 20:00 ferry.',
    soloVerified: true,
    visitedProvinces: ['İstanbul', 'Nevşehir'],
    badges: ['bogaz-walker', 'island-hopper'],
    preferredHubs: ['ortakoy-bebek', 'adalar'],
    budgetLevel: 'mid',
    identifiesAsWoman: true,
    visibleToWomenOnly: false,
  },
];
