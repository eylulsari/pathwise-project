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
    // No declaration.
  },
];
