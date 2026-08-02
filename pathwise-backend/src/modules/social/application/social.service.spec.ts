import { SocialService } from './social.service';

/**
 * Opt-in women-traveler mode. The seed (traveler.dataset.ts) is:
 *   t1 Mara   — declared, visible to all
 *   t2 Diego  — no declaration
 *   t3 Yuki   — declared, visibleToWomenOnly
 *   t4 Amara  — declared, visible to all
 *   t5 Liam   — no declaration
 */
describe('SocialService — women-traveler filter', () => {
  const service = new SocialService();
  const optedIn = { womenModeActive: true };
  const browsing = { womenModeActive: false };

  const ids = (r: { travelers: { id: string }[] }) => r.travelers.map((t) => t.id);

  it('returns everyone discoverable when no filter is applied', () => {
    // t3 opted out of the default list; the other four stay.
    expect(ids(service.listTravelers({}, browsing))).toEqual([
      't1',
      't2',
      't4',
      't5',
    ]);
  });

  it('keeps only self-declared travelers when the filter is on', () => {
    const result = service.listTravelers({ womenOnly: true }, optedIn);
    expect(result.womenOnlyApplied).toBe(true);
    expect(ids(result)).toEqual(['t1', 't3', 't4']);
    // Nobody without a declaration leaks in.
    expect(ids(result)).not.toContain('t2');
    expect(ids(result)).not.toContain('t5');
  });

  it('is off by default — an unset filter never narrows the list', () => {
    const result = service.listTravelers({}, optedIn);
    expect(result.womenOnlyApplied).toBe(false);
    expect(ids(result)).toContain('t2');
    expect(ids(result)).toContain('t5');
  });

  it('hides visibleToWomenOnly travelers from viewers who have not opted in', () => {
    expect(ids(service.listTravelers({}, browsing))).not.toContain('t3');
    expect(ids(service.listTravelers({}, optedIn))).toContain('t3');
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
    expect(ids(result)).toEqual(['t4']); // Amara: declared + #Foodie
  });
});
