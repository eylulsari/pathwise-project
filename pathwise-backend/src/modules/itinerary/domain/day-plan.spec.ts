import { planHubSequence, MAX_TRIP_DAYS } from './day-plan';
import { HUB_DATASET, HUB_SIDE } from '../../places/infrastructure/persistence/hub.dataset';

/**
 * Derived from the real hub dataset rather than a fixture: the rules are about
 * the hubs the app actually plans around, and a fixture would keep passing
 * after someone removed half of them.
 */
describe('planHubSequence', () => {
  it.each([1, 2, 3, 4, 5, 6, 7])('never repeats a hub across a %i-day trip', (days) => {
    const sequence = planHubSequence(days, HUB_DATASET);
    expect(sequence).toHaveLength(days);
    expect(new Set(sequence).size).toBe(days);
  });

  it('never puts the same shore on two days in a row', () => {
    // Fifteen hubs across three sides is enough to alternate every day up to
    // the maximum; if it ever is not, this fails rather than quietly
    // clustering.
    const sequence = planHubSequence(MAX_TRIP_DAYS, HUB_DATASET);
    for (let i = 1; i < sequence.length; i++) {
      expect(HUB_SIDE[sequence[i]]).not.toBe(HUB_SIDE[sequence[i - 1]]);
    }
  });

  it('spreads a week across both shores rather than favouring one', () => {
    const sides = planHubSequence(MAX_TRIP_DAYS, HUB_DATASET).map((h) => HUB_SIDE[h]);
    expect(sides.filter((s) => s === 'European').length).toBeGreaterThan(1);
    expect(sides.filter((s) => s === 'Asian').length).toBeGreaterThan(1);
  });

  it('keeps the islands out of a short trip', () => {
    // A ferry day costs ninety minutes each way. On a two-day trip that is
    // half the holiday.
    expect(planHubSequence(1, HUB_DATASET)).not.toContain('adalar');
    expect(planHubSequence(2, HUB_DATASET)).not.toContain('adalar');
  });

  it('offers the islands once the trip is long enough', () => {
    expect(planHubSequence(MAX_TRIP_DAYS, HUB_DATASET)).toContain('adalar');
  });

  it('is deterministic — the same request gives the same trip', () => {
    expect(planHubSequence(5, HUB_DATASET)).toEqual(planHubSequence(5, HUB_DATASET));
  });

  it('is a prefix-stable plan — extending a trip keeps the earlier days', () => {
    // Adding a day must not reshuffle days the traveller has already edited.
    // (Day 3 is where the islands become eligible, so compare from there up.)
    for (let days = 3; days < MAX_TRIP_DAYS; days++) {
      const shorter = planHubSequence(days, HUB_DATASET);
      const longer = planHubSequence(days + 1, HUB_DATASET);
      expect(longer.slice(0, days)).toEqual(shorter);
    }
  });

  it('returns nothing for a zero-day trip, and does not throw', () => {
    expect(planHubSequence(0, HUB_DATASET)).toEqual([]);
    expect(planHubSequence(-3, HUB_DATASET)).toEqual([]);
    expect(planHubSequence(3, [])).toEqual([]);
  });

  it('survives a dataset smaller than the trip, without consecutive repeats', () => {
    // Unreachable through the UI (15 hubs, seven-day cap) but the function has
    // to be total — a crash here would take the whole dashboard down.
    const twoHubs = HUB_DATASET.filter((h) =>
      ['sultanahmet', 'kadikoy-moda'].includes(h.id),
    );
    const sequence = planHubSequence(5, twoHubs);
    expect(sequence).toHaveLength(5);
    for (let i = 1; i < sequence.length; i++) {
      expect(sequence[i]).not.toBe(sequence[i - 1]);
    }
  });
});
