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
  // Reclassified with the 10-hub expansion: Ortaköy and Bebek have their own
  // hub now, so filing this under Beşiktaş sent Clone to the wrong place list.
  { id: 'r10', title: 'Ortaköy to Bebek waterfront', authorName: 'Hana K.', hub: 'ortakoy-bebek', stops: 4, distanceKm: 2.6, seedLikes: 94, tags: ['photo', 'nature'] },

  // ── Added with the 10-hub expansion ──────────────────────────────
  // Two per new hub. A hub with no community route shows an empty Social tab
  // the moment someone filters to it, and Clone has nothing to hand the
  // dashboard. Appended rather than interleaved: the seed order is the display
  // order, and two e2e specs depend on which card is first.
  { id: 'r11', title: 'Bazaar quarter, back lanes first', authorName: 'Zeynep A.', hub: 'eminonu-sirkeci', stops: 5, distanceKm: 1.7, seedLikes: 141, tags: ['market', 'local', 'hiddengem'] },
  { id: 'r12', title: 'Sinan’s hill: Süleymaniye and down', authorName: 'Noor H.', hub: 'eminonu-sirkeci', stops: 4, distanceKm: 2.0, seedLikes: 83, tags: ['history', 'view', 'culture'] },
  { id: 'r13', title: 'İstiklal arcades after dark', authorName: 'Sofia N.', hub: 'beyoglu-taksim', stops: 5, distanceKm: 1.5, seedLikes: 168, tags: ['nightlife', 'photo', 'hiddengem'] },
  { id: 'r14', title: 'Pera on a student budget', authorName: 'Arda K.', hub: 'beyoglu-taksim', stops: 4, distanceKm: 1.3, seedLikes: 72, tags: ['food', 'art', 'local'] },
  { id: 'r15', title: 'Çamlıca at dawn', authorName: 'Leyla D.', hub: 'uskudar', stops: 3, distanceKm: 2.2, seedLikes: 119, tags: ['view', 'photo', 'relax'] },
  { id: 'r16', title: 'Kuzguncuk’s painted lanes', authorName: 'Erik B.', hub: 'uskudar', stops: 4, distanceKm: 1.6, seedLikes: 97, tags: ['photo', 'hiddengem', 'relax'] },
  { id: 'r17', title: 'Büyükada without the crowds', authorName: 'Grace M.', hub: 'adalar', stops: 5, distanceKm: 4.1, seedLikes: 134, tags: ['nature', 'relax', 'experience'] },
  { id: 'r18', title: 'Two islands, one ferry ticket', authorName: 'Paolo R.', hub: 'adalar', stops: 4, distanceKm: 3.4, seedLikes: 88, tags: ['experience', 'food', 'view'] },
  { id: 'r19', title: 'Blue hour on the Bosphorus', authorName: 'Mei C.', hub: 'ortakoy-bebek', stops: 4, distanceKm: 2.9, seedLikes: 156, tags: ['photo', 'view', 'relax'] },
  { id: 'r20', title: 'Bebek to Rumeli Hisarı on foot', authorName: 'Erik B.', hub: 'ortakoy-bebek', stops: 4, distanceKm: 2.4, seedLikes: 76, tags: ['history', 'nature', 'view'] },
  // Beşiktaş dropped to a single route when r10 moved to its own hub; this
  // brings it back to two so no hub is thinner than the rest.
  { id: 'r21', title: 'Beşiktaş: palace, park, fish market', authorName: 'Tom W.', hub: 'besiktas-bogaz', stops: 4, distanceKm: 2.3, seedLikes: 108, tags: ['history', 'food', 'nature'] },
];
