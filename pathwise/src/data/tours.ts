/**
 * Guided tours, as affiliate referrals.
 *
 * ── What this is not ─────────────────────────────────────────────────
 * Pathwise does not sell, book, or take payment for any of these. Every card
 * is a link out to GetYourGuide, who own the booking, the price and the
 * cancellation terms. That is why there is no price field below and no
 * component that could render one: we do not have GetYourGuide's live prices,
 * and a number we made up would be worse than no number — it would be a quote
 * the user could hold us to. The call to action sends them to look instead.
 *
 * ── Why this is not a database table ─────────────────────────────────
 * There are three of them and they change when someone edits this file, the
 * same as the Essentials content. A table would add a migration, a repository
 * and an endpoint to serve data that is already in the bundle.
 *
 * Titles and descriptions live in `i18n/translations.ts` under `tours.items.*`
 * so both languages stay in one place; only the parts that are not prose —
 * the id, the category and the URL — are here.
 */
export type TourCategory = 'bosphorus' | 'historic' | 'walking';

export interface Tour {
  /** Also the i18n key: `tours.items.<id>.title` / `.desc`. */
  id: string;
  category: TourCategory;
  /**
   * The affiliate link. Opened in a new tab with `rel="sponsored"` — the
   * honest description of a paid referral, and what search engines expect.
   */
  url: string;
}

/**
 * ⚠️ Each title below was checked against where its link actually lands, by
 * following the redirect. Two of them did not match the label they arrived
 * with: the second link is Hagia Sophia alone (no Topkapı), and the third is a
 * Fener–Balat walk rather than an old-city one. The entries follow the
 * destination, because the destination is what the reader will get.
 *
 * If a link is ever swapped, follow it first. A title that describes a
 * different tour than the one it opens is the same failure as an invented
 * price — it is a promise the page cannot keep.
 */
export const TOURS: Tour[] = [
  // → …/istanbul-ozel-masa-ile-bogaz-turu-ve-aksam-yemegi-t415437
  { id: 'bosphorus-dinner-cruise', category: 'bosphorus', url: 'https://gyg.me/SehMD5H0' },
  // → …/istanbul-yerel-rehberinizle-ayasofya-rehberli-turu-t1439112
  { id: 'hagia-sophia-guided', category: 'historic', url: 'https://gyg.me/FkXUBF9r' },
  // → …/istanbul-fener-balat-yarim-gunluk-rehberli-yuruyus-turu-t454786
  { id: 'fener-balat-walk', category: 'walking', url: 'https://gyg.me/fTDITut1' },
];
