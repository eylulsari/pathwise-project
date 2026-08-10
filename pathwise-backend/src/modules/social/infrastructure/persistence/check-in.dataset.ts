import { Hub } from '../../../places/domain/place';
import { CheckIn, CheckInAuthor } from '../../domain/check-in';

/**
 * Curated demo check-in feed — moved here from the frontend mock layer when
 * check-ins became a real endpoint.
 *
 * Authored as "how long ago" rather than as timestamps, and resolved against
 * the clock on every read. A fixed timestamp would age: within a day the whole
 * feed would be stale, and the presence feature would have nothing left to
 * distinguish. The spread is deliberate — entries either side of the two-hour
 * presence window, so "available now" vs "checked in earlier" is always
 * demonstrable.
 *
 * These authors are the travelers from `traveler.dataset.ts`, who have no user
 * accounts. Real check-ins are persisted separately and merged in at read time
 * (see `CheckInsService`), so signing up never empties the feed.
 */
interface CheckInSeedEntry {
  id: string;
  traveler: CheckInAuthor;
  placeId: string;
  hub: Hub;
  message: string;
  minutesAgo: number;
}

const SEED: CheckInSeedEntry[] = [
  { id: 'c1', traveler: { id: 't1', name: 'Mara Lindqvist', avatarColor: '#4A7C82' }, placeId: 'ChIJ-galata-tower', hub: 'karakoy-galata', message: 'Golden hour is unreal up here 🌇', minutesAgo: 8 },
  { id: 'c2', traveler: { id: 't2', name: 'Diego Fernández', avatarColor: '#C56F52' }, placeId: 'ChIJ-kadikoy-ciya', hub: 'kadikoy-moda', message: 'Anyone want to split a table? So much food.', minutesAgo: 21 },
  { id: 'c3', traveler: { id: 't4', name: 'Amara Okafor', avatarColor: '#B5654A' }, placeId: 'ChIJ-kadikoy-carsi', hub: 'kadikoy-moda', message: 'Pickle shop tour starting now 🥒', minutesAgo: 34 },
  { id: 'c8', traveler: { id: 't10', name: 'Elif Şahin', avatarColor: '#C98A3E' }, placeId: 'ChIJ-kadikoy-moda-sahil', hub: 'kadikoy-moda', message: 'Çay ve simit, sahilde. Yerliyim, soru sorabilirsiniz ☕', minutesAgo: 41 },
  { id: 'c4', traveler: { id: 't3', name: 'Yuki Tanaka', avatarColor: '#6E8F74' }, placeId: 'ChIJ-balat-colorfulhouses', hub: 'balat-fener', message: 'Sketching the terraces, come say hi.', minutesAgo: 52 },
  { id: 'c9', traveler: { id: 't9', name: 'Tom Whitaker', avatarColor: '#4F7C5E' }, placeId: 'ChIJ-besiktas-ortakoy-kumpir', hub: 'besiktas-bogaz', message: 'Bridge view table just opened up, two seats free 🌉', minutesAgo: 58 },
  { id: 'c5', traveler: { id: 't5', name: 'Liam O’Connor', avatarColor: '#3F6E8C' }, placeId: 'ChIJ-kadikoy-modapier', hub: 'kadikoy-moda', message: 'End of the deck, 270° of water. Staying for sunset ⚓', minutesAgo: 66 },
  { id: 'c10', traveler: { id: 't7', name: 'Noah Weber', avatarColor: '#5B7A99' }, placeId: 'ChIJ-balat-fenerpatriarchate', hub: 'balat-fener', message: 'Last two frames on this roll. Red brick against grey sky, worth the walk up.', minutesAgo: 95 },
  { id: 'c11', traveler: { id: 't6', name: 'Sofia Marchetti', avatarColor: '#A8574C' }, placeId: 'ChIJ-sultanahmet-hagiasophia', hub: 'sultanahmet', message: 'Queue is twenty minutes at this hour, not the two you read about.', minutesAgo: 112 },
  { id: 'c6', traveler: { id: 't1', name: 'Mara Lindqvist', avatarColor: '#4A7C82' }, placeId: 'ChIJ-sultanahmet-spicebazaar', hub: 'sultanahmet', message: 'Bought saffron on Hasırcılar instead of inside — half the price 🌶️', minutesAgo: 128 },
  { id: 'c12', traveler: { id: 't12', name: 'Camila Rojas', avatarColor: '#B85C7A' }, placeId: 'ChIJ-galata-karakoylokantasi', hub: 'karakoy-galata', message: 'Lunch menu is the cheap way into this place. Gone now, but go.', minutesAgo: 155 },
  { id: 'c7', traveler: { id: 't4', name: 'Amara Okafor', avatarColor: '#B5654A' }, placeId: 'ChIJ-kadikoy-yeldegirmeni', hub: 'kadikoy-moda', message: 'Following the mural trail street by street, it just keeps going 🎨', minutesAgo: 184 },
  { id: 'c13', traveler: { id: 't14', name: 'Kenji Mori', avatarColor: '#8A6B4F' }, placeId: 'ChIJ-sultanahmet-kucukayasofya', hub: 'sultanahmet', message: 'Courtyard was empty at opening. Headed back to the tea garden now.', minutesAgo: 240 },
];

/** Materialise the seed against a clock. `now` is injected so it is testable. */
export function seedCheckIns(now: number = Date.now()): CheckIn[] {
  return SEED.map((entry) => ({
    id: entry.id,
    traveler: entry.traveler,
    placeId: entry.placeId,
    hub: entry.hub,
    message: entry.message,
    createdAt: new Date(now - entry.minutesAgo * 60_000),
  }));
}
