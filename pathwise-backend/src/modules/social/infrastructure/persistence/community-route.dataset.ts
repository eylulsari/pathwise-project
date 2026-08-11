import { Hub, Interest } from '../../../places/domain/place';

/**
 * Curated community routes — moved here from the frontend mock when likes
 * became persistent.
 *
 * The routes themselves stay a seed: there is no "publish a route" UI, so
 * persisting them would be a new feature. What users actually do — liking —
 * is what got a table.
 *
 * `seedLikes` is a STATIC demo baseline and is never mutated. The number a
 * viewer sees is `seedLikes + COUNT(route_likes)`, so nothing anywhere is
 * incremented or decremented and the count cannot drift out of step with the
 * rows that justify it.
 */
export interface CommunityRouteSeed {
  id: string;
  title: string;
  authorName: string;
  hub: Hub;
  stops: number;
  distanceKm: number;
  seedLikes: number;
  tags: Interest[];
}

export const COMMUNITY_ROUTE_SEED: CommunityRouteSeed[] = [
  { id: 'r1', title: 'Asian-side food crawl', authorName: 'Diego F.', hub: 'kadikoy-moda', stops: 5, distanceKm: 2.1, seedLikes: 128, tags: ['food', 'market'] },
  { id: 'r2', title: 'Galata golden-hour loop', authorName: 'Mara L.', hub: 'karakoy-galata', stops: 4, distanceKm: 1.6, seedLikes: 96, tags: ['photo', 'history'] },
  { id: 'r3', title: 'Balat rainbow morning', authorName: 'Yuki T.', hub: 'balat-fener', stops: 5, distanceKm: 1.9, seedLikes: 74, tags: ['photo', 'art'] },
  { id: 'r4', title: 'Old City in one day', authorName: 'Amara O.', hub: 'sultanahmet', stops: 6, distanceKm: 2.8, seedLikes: 203, tags: ['history', 'photo'] },
  { id: 'r5', title: 'Bosphorus villages by ferry', authorName: 'Tom W.', hub: 'besiktas-bogaz', stops: 4, distanceKm: 3.2, seedLikes: 152, tags: ['nature', 'photo'] },
  { id: 'r6', title: 'The Sinan circuit', authorName: 'Kenji M.', hub: 'sultanahmet', stops: 5, distanceKm: 2.4, seedLikes: 88, tags: ['history'] },
  { id: 'r7', title: 'Moda, slowly', authorName: 'Marcus A.', hub: 'kadikoy-moda', stops: 3, distanceKm: 1.4, seedLikes: 61, tags: ['nature', 'food'] },
  { id: 'r8', title: 'Karaköy uphill: coffee, art, baklava', authorName: 'Camila R.', hub: 'karakoy-galata', stops: 5, distanceKm: 1.8, seedLikes: 117, tags: ['food', 'art'] },
  { id: 'r9', title: 'Fener antiques & spice hunt', authorName: 'Elif Ş.', hub: 'balat-fener', stops: 4, distanceKm: 1.5, seedLikes: 79, tags: ['market', 'art'] },
  { id: 'r10', title: 'Ortaköy to Bebek waterfront', authorName: 'Hana K.', hub: 'besiktas-bogaz', stops: 4, distanceKm: 2.6, seedLikes: 94, tags: ['photo', 'nature'] },
];
