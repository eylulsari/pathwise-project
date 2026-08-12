import { SocialService } from './social.service';
import { TRAVELER_SEED } from '../infrastructure/persistence/traveler.dataset';
import { HUB_DATASET } from '../../places/infrastructure/persistence/hub.dataset';

/**
 * Opt-in women-traveler mode.
 *
 * Expectations are DERIVED FROM THE SEED rather than hardcoded as id lists:
 * the seed is demo content that grows, and a test that fails because someone
 * added a traveler is a test that will eventually be silenced rather than
 * read. What is asserted here is the *rule*, not the roster — with a couple of
 * explicit spot-checks so the intent stays legible.
 */
describe('SocialService — women-traveler filter', () => {
  const service = new SocialService();
  const optedIn = { womenModeActive: true };
  const browsing = { womenModeActive: false };

  const ids = (r: { travelers: { id: string }[] }) => r.travelers.map((t) => t.id);

  const declared = TRAVELER_SEED.filter((t) => t.identifiesAsWoman === true);
  const womenOnlyVisible = TRAVELER_SEED.filter((t) => t.visibleToWomenOnly);
  const openToAll = TRAVELER_SEED.filter((t) => !t.visibleToWomenOnly);

  it('has a seed that can actually exercise both sides of the rule', () => {
    // Guards the tests below: if the seed ever loses its variety they would
    // start passing vacuously.
    expect(declared.length).toBeGreaterThan(1);
    expect(womenOnlyVisible.length).toBeGreaterThan(1);
    expect(TRAVELER_SEED.length).toBeGreaterThan(womenOnlyVisible.length);
  });

  it('returns everyone discoverable when no filter is applied', () => {
    expect(ids(service.listTravelers({}, browsing))).toEqual(
      openToAll.map((t) => t.id),
    );
  });

  it('keeps only self-declared travelers when the filter is on', () => {
    const result = service.listTravelers({ womenOnly: true }, optedIn);
    expect(result.womenOnlyApplied).toBe(true);
    expect(ids(result)).toEqual(declared.map((t) => t.id));
    // Nobody without a declaration leaks in.
    for (const t of TRAVELER_SEED.filter((x) => x.identifiesAsWoman !== true)) {
      expect(ids(result)).not.toContain(t.id);
    }
  });

  it('is off by default — an unset filter never narrows the list', () => {
    const result = service.listTravelers({}, optedIn);
    expect(result.womenOnlyApplied).toBe(false);
    expect(ids(result)).toContain('t2'); // Diego, no declaration
    expect(ids(result)).toContain('t5'); // Liam, no declaration
  });

  it('hides visibleToWomenOnly travelers from viewers who have not opted in', () => {
    const browsingIds = ids(service.listTravelers({}, browsing));
    const optedInIds = ids(service.listTravelers({}, optedIn));
    for (const t of womenOnlyVisible) {
      expect(browsingIds).not.toContain(t.id);
      expect(optedInIds).toContain(t.id);
    }
  });

  it('refuses the filter for viewers who have not opted in themselves', () => {
    // Reciprocity: honouring this would leak who declared, which is exactly
    // what redacting the flag is meant to prevent.
    const result = service.listTravelers({ womenOnly: true }, browsing);
    expect(result.womenOnlyApplied).toBe(false);
    expect(ids(result)).toContain('t2');
  });

  it('never exposes the declaration to viewers who have not opted in', () => {
    for (const t of service.listTravelers({}, browsing).travelers) {
      expect(t).not.toHaveProperty('identifiesAsWoman');
      expect(t).not.toHaveProperty('visibleToWomenOnly');
    }
  });

  it('exposes the declaration to opted-in viewers, but never the visibility switch', () => {
    const mara = service
      .listTravelers({}, optedIn)
      .travelers.find((t) => t.id === 't1');
    expect(mara).toMatchObject({ identifiesAsWoman: true });
    expect(mara).not.toHaveProperty('visibleToWomenOnly');
  });

  it('combines with the existing tag filter', () => {
    const result = service.listTravelers(
      { womenOnly: true, tag: '#Foodie' },
      optedIn,
    );
    const expected = declared
      .filter((t) => t.tags.includes('#Foodie'))
      .map((t) => t.id);
    expect(ids(result)).toEqual(expected);
    expect(expected.length).toBeGreaterThan(0); // the filter must not be vacuous
  });
});

/**
 * The seed is demo *content*, but buddy matching reads it as *data* — a gap in
 * it shows up as an empty filter or a ranking that cannot separate anyone.
 * These assert the spread the matching feature depends on.
 */
describe('traveler seed — coverage the matcher depends on', () => {
  // Derived from the hub dataset, NOT restated here.
  //
  // This list used to be a hand-written copy of the five original hubs, which
  // meant the coverage assertion below could only ever ask about hubs someone
  // had remembered to add to it. When the app grew to ten hubs the seed gained
  // no travelers for the five new ones — the matcher's hub component silently
  // scored 0 for anyone whose trips were there — and this suite stayed green,
  // because it never thought to ask. A check that cannot notice the thing it
  // exists to notice is worse than no check: it reads as reassurance.
  const HUBS = HUB_DATASET.map((h) => h.id);
  const TAGS = [
    '#SoloVerified',
    '#Foodie',
    '#Backpacker',
    '#CultureSeeker',
    '#PhotoNomad',
    '#SlowTravel',
  ] as const;

  it('gives every traveler the inputs the scorer needs', () => {
    for (const t of TRAVELER_SEED) {
      expect(t.preferredHubs.length).toBeGreaterThan(0);
      expect(t.budgetLevel).not.toBeNull();
      expect(t.tags.length).toBeGreaterThan(0);
    }
  });

  it('covers every hub at least twice, so trip history separates the list', () => {
    for (const hub of HUBS) {
      const count = TRAVELER_SEED.filter((t) => t.preferredHubs.includes(hub)).length;
      expect(count).toBeGreaterThanOrEqual(2);
    }
  });

  it('covers every tag at least three times, so no style filter lands empty', () => {
    for (const tag of TAGS) {
      const count = TRAVELER_SEED.filter((t) => t.tags.includes(tag)).length;
      expect(count).toBeGreaterThanOrEqual(3);
    }
  });

  it('represents all three budget levels', () => {
    for (const level of ['budget', 'mid', 'comfort'] as const) {
      expect(TRAVELER_SEED.some((t) => t.budgetLevel === level)).toBe(true);
    }
  });

  it('does not make #SoloVerified read as a gendered marker', () => {
    const solo = TRAVELER_SEED.filter((t) => t.tags.includes('#SoloVerified'));
    expect(solo.some((t) => t.identifiesAsWoman === true)).toBe(true);
    expect(solo.some((t) => t.identifiesAsWoman === undefined)).toBe(true);
  });

  it('has unique ids', () => {
    const ids = TRAVELER_SEED.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
