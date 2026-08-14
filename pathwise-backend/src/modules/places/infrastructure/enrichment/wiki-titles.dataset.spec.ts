import { PLACE_DATASET } from '../persistence/place.dataset';
import { WIKI_TITLES } from './wiki-titles.dataset';

/**
 * `wiki-titles.dataset.ts` is generated, and generated data can regress in a
 * way hand-written data cannot: a transient network error during seeding leaves
 * no entry and no trace, and the run still reports a confident total.
 *
 * That is not hypothetical. Replacing the hand-written six-landmark allowlist
 * with this dataset dropped **Hagia Sophia** — the seeder's very first request
 * failed, the place got no cache entry, and nothing noticed until an e2e spec
 * opened its story modal and found no enrichment panel.
 *
 * These tests are the floor the generated file has to clear.
 */
describe('WIKI_TITLES', () => {
  /**
   * The landmarks that carried enrichment before the dataset existed. Losing
   * any of them is a regression by definition — a traveller who had a real
   * description yesterday would have none today.
   */
  const PREVIOUSLY_CURATED = [
    'ChIJ-sultanahmet-hagiasophia',
    'ChIJ-sultanahmet-bluemosque',
    'ChIJ-sultanahmet-topkapi',
    'ChIJ-sultanahmet-basilicacistern',
    'ChIJ-sultanahmet-grandbazaar',
    'ChIJ-galata-tower',
  ];

  it.each(PREVIOUSLY_CURATED)('still has a Wikipedia title for %s', (placeId) => {
    expect(WIKI_TITLES[placeId]).toBeTruthy();
  });

  it('has no blank titles', () => {
    for (const [placeId, title] of Object.entries(WIKI_TITLES)) {
      expect(title.trim()).not.toBe('');
      expect(placeId.trim()).not.toBe('');
    }
  });

  it('keys every entry to a place that actually exists', () => {
    // A title pointing at a deleted or renamed placeId is dead weight that no
    // request will ever reach, and it would hide a real drop in coverage.
    const known = new Set(PLACE_DATASET.map((p) => p.placeId));
    const orphans = Object.keys(WIKI_TITLES).filter((id) => !known.has(id));
    expect(orphans).toEqual([]);
  });

  it('covers a meaningful share of the catalogue', () => {
    // Not a target to chase — a floor that makes a collapsed regeneration
    // (say, one that errored on most requests) fail loudly instead of shipping.
    const coverage = Object.keys(WIKI_TITLES).length / PLACE_DATASET.length;
    expect(coverage).toBeGreaterThan(0.4);
  });
});
