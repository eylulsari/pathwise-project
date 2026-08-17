import { SocialService } from './social.service';
import { UsersService } from '../../users/application/users.service';
import { MessagingService } from '../../messaging/application/messaging.service';
import { User } from '../../users/domain/user';
import { TRAVELER_SEED } from '../infrastructure/persistence/traveler.dataset';
import { HUB_DATASET } from '../../places/infrastructure/persistence/hub.dataset';

/**
 * A real account, with only the fields the buddy list reads.
 *
 * Overrides are spread last rather than merged with `??`, so passing `null`
 * for an optional field means null. With `??` the "half-filled profile" case
 * below silently got the defaults back and asserted nothing.
 */
function account(over: Partial<ConstructorParameters<typeof User>[0]> = {}): User {
  return new User({
    id: 'u-1',
    name: 'Real Person',
    email: 'real@example.com',
    passwordHash: 'x',
    nationality: 'Türkiye',
    age: 30,
    travelStyles: ['#Foodie'],
    bio: null,
    identifiesAsWoman: null,
    visibleToWomenOnly: false,
    showWomenOnly: false,
    createdAt: new Date(),
    ...over,
  });
}

/**
 * Stand-ins for the two collaborators.
 *
 * `listDiscoverable` honours `includeWomenOnlyVisible` here the same way the
 * SQL does, because that argument is the service's half of the reciprocity
 * rule — a fake that ignored it would let the rule pass untested.
 */
function services(accounts: User[], blocked: string[] = []) {
  const users = {
    listDiscoverable: async (o: {
      excludeUserId: string;
      includeWomenOnlyVisible: boolean;
    }) =>
      accounts
        .filter((u) => u.id !== o.excludeUserId)
        .filter((u) => o.includeWomenOnlyVisible || !u.visibleToWomenOnly),
  } as unknown as UsersService;
  const messaging = {
    blockedIds: async () => new Set(blocked),
  } as unknown as MessagingService;
  return new SocialService(users, messaging);
}

const optedIn = { womenModeActive: true };
const browsing = { womenModeActive: false };

/**
 * Opt-in women-traveler mode, over the demo seed.
 *
 * Expectations are DERIVED FROM THE SEED rather than hardcoded as id lists:
 * the seed is demo content that grows, and a test that fails because someone
 * added a traveler is a test that will eventually be silenced rather than
 * read. What is asserted here is the *rule*, not the roster — with a couple of
 * explicit spot-checks so the intent stays legible.
 */
describe('SocialService — women-traveler filter over the sample profiles', () => {
  const service = services([]);
  const ids = (r: { sampleTravelers: { id: string }[] }) =>
    r.sampleTravelers.map((t) => t.id);

  const declared = TRAVELER_SEED.filter((t) => t.identifiesAsWoman === true);
  const womenOnlyVisible = TRAVELER_SEED.filter((t) => t.visibleToWomenOnly);
  const openToAll = TRAVELER_SEED.filter((t) => !t.visibleToWomenOnly);

  it('has a seed that can actually exercise both sides of the rule', async () => {
    // Guards the tests below: if the seed ever loses its variety they would
    // start passing vacuously.
    expect(declared.length).toBeGreaterThan(1);
    expect(womenOnlyVisible.length).toBeGreaterThan(1);
    expect(TRAVELER_SEED.length).toBeGreaterThan(womenOnlyVisible.length);
  });

  it('returns everyone discoverable when no filter is applied', async () => {
    expect(ids(await service.listTravelers({}, browsing, 'me'))).toEqual(
      openToAll.map((t) => t.id),
    );
  });

  it('keeps only self-declared travelers when the filter is on', async () => {
    const result = await service.listTravelers({ womenOnly: true }, optedIn, 'me');
    expect(result.womenOnlyApplied).toBe(true);
    expect(ids(result)).toEqual(declared.map((t) => t.id));
    // Nobody without a declaration leaks in.
    for (const t of TRAVELER_SEED.filter((x) => x.identifiesAsWoman !== true)) {
      expect(ids(result)).not.toContain(t.id);
    }
  });

  it('is off by default — an unset filter never narrows the list', async () => {
    const result = await service.listTravelers({}, optedIn, 'me');
    expect(result.womenOnlyApplied).toBe(false);
    expect(ids(result)).toContain('t2'); // Diego, no declaration
    expect(ids(result)).toContain('t5'); // Liam, no declaration
  });

  it('hides visibleToWomenOnly travelers from viewers who have not opted in', async () => {
    const browsingIds = ids(await service.listTravelers({}, browsing, 'me'));
    const optedInIds = ids(await service.listTravelers({}, optedIn, 'me'));
    for (const t of womenOnlyVisible) {
      expect(browsingIds).not.toContain(t.id);
      expect(optedInIds).toContain(t.id);
    }
  });

  it('refuses the filter for viewers who have not opted in themselves', async () => {
    // Reciprocity: honouring this would leak who declared, which is exactly
    // what redacting the flag is meant to prevent.
    const result = await service.listTravelers({ womenOnly: true }, browsing, 'me');
    expect(result.womenOnlyApplied).toBe(false);
    expect(ids(result)).toContain('t2');
  });

  it('never exposes the declaration to viewers who have not opted in', async () => {
    const { sampleTravelers } = await service.listTravelers({}, browsing, 'me');
    for (const t of sampleTravelers) {
      expect(t).not.toHaveProperty('identifiesAsWoman');
      expect(t).not.toHaveProperty('visibleToWomenOnly');
    }
  });

  it('exposes the declaration to opted-in viewers, but never the visibility switch', async () => {
    const { sampleTravelers } = await service.listTravelers({}, optedIn, 'me');
    const mara = sampleTravelers.find((t) => t.id === 't1');
    expect(mara).toMatchObject({ identifiesAsWoman: true });
    expect(mara).not.toHaveProperty('visibleToWomenOnly');
  });

  it('combines with the existing tag filter', async () => {
    const result = await service.listTravelers(
      { womenOnly: true, tag: '#Foodie' },
      optedIn,
      'me',
    );
    const expected = declared
      .filter((t) => t.tags.includes('#Foodie'))
      .map((t) => t.id);
    expect(ids(result)).toEqual(expected);
    expect(expected.length).toBeGreaterThan(0); // the filter must not be vacuous
  });
});

/**
 * The separation itself — the point of the whole change.
 *
 * The buddy list used to be the demo seed and nothing else, so every action it
 * offered pointed at somebody who did not exist. These assert that the two
 * sources stay apart, in both directions: no fixture reaches the actionable
 * list, and no account is quietly demoted to decoration.
 */
describe('SocialService — samples are never in the actionable list', () => {
  it('puts real accounts in `travelers` and the seed in `sampleTravelers`', async () => {
    const service = services([account({ id: 'u-1', name: 'Ada' })]);
    const { travelers, sampleTravelers } = await service.listTravelers({}, browsing, 'me');

    expect(travelers.map((t) => t.id)).toEqual(['u-1']);
    expect(sampleTravelers.length).toBeGreaterThan(0);
  });

  it('lets no seed id into the actionable list, whatever the filters', async () => {
    const seedIds = new Set(TRAVELER_SEED.map((t) => t.id));
    const service = services([account({ id: 'u-1' })]);

    for (const [options, viewer] of [
      [{}, browsing],
      [{}, optedIn],
      [{ womenOnly: true }, optedIn],
      [{ tag: '#Foodie' as const }, browsing],
    ] as const) {
      const { travelers } = await service.listTravelers(options, viewer, 'me');
      for (const t of travelers) expect(seedIds.has(t.id)).toBe(false);
    }
  });

  it('marks every entry on both sides, so the client never has to guess', async () => {
    const service = services([account({ id: 'u-1' })]);
    const { travelers, sampleTravelers } = await service.listTravelers({}, browsing, 'me');

    expect(travelers.every((t) => t.isSample === false)).toBe(true);
    expect(sampleTravelers.every((t) => t.isSample === true)).toBe(true);
  });

  it('leaves the actionable list empty rather than filling it with fixtures', async () => {
    // The honest answer when nobody has signed up yet. Falling back to the seed
    // here is exactly the bug this change removes.
    const { travelers, sampleTravelers } = await services([]).listTravelers(
      {},
      browsing,
      'me',
    );
    expect(travelers).toEqual([]);
    expect(sampleTravelers.length).toBeGreaterThan(0);
  });
});

/** The rules that only apply to accounts, because only accounts are people. */
describe('SocialService — real accounts', () => {
  it('never lists the viewer to themselves', async () => {
    const service = services([account({ id: 'me' }), account({ id: 'u-2' })]);
    const { travelers } = await service.listTravelers({}, browsing, 'me');
    expect(travelers.map((t) => t.id)).toEqual(['u-2']);
  });

  it('hides accounts either side has blocked', async () => {
    const service = services(
      [account({ id: 'u-1' }), account({ id: 'blocked-one' })],
      ['blocked-one'],
    );
    const { travelers } = await service.listTravelers({}, browsing, 'me');
    expect(travelers.map((t) => t.id)).toEqual(['u-1']);
  });

  it('applies the same visibility reciprocity as the seed', async () => {
    const accounts = [
      account({ id: 'open' }),
      account({ id: 'women-only', identifiesAsWoman: true, visibleToWomenOnly: true }),
    ];
    expect(
      (await services(accounts).listTravelers({}, browsing, 'me')).travelers.map((t) => t.id),
    ).toEqual(['open']);
    expect(
      (await services(accounts).listTravelers({}, optedIn, 'me')).travelers.map((t) => t.id),
    ).toEqual(['open', 'women-only']);
  });

  it('redacts the declaration for viewers who have not opted in', async () => {
    const accounts = [account({ id: 'u-1', identifiesAsWoman: true })];
    const hidden = (await services(accounts).listTravelers({}, browsing, 'me')).travelers[0];
    const shown = (await services(accounts).listTravelers({}, optedIn, 'me')).travelers[0];

    expect(hidden).not.toHaveProperty('identifiesAsWoman');
    expect(shown).toMatchObject({ identifiesAsWoman: true });
  });

  it('filters accounts by tag, reading their own travel styles', async () => {
    const service = services([
      account({ id: 'foodie', travelStyles: ['#Foodie'] }),
      account({ id: 'photo', travelStyles: ['#PhotoNomad'] }),
    ]);
    const { travelers } = await service.listTravelers({ tag: '#Foodie' }, browsing, 'me');
    expect(travelers.map((t) => t.id)).toEqual(['foodie']);
  });

  it('keeps a half-filled profile rather than inventing values for it', async () => {
    // A real account is whatever its owner typed in. An age of 0 or an empty
    // nationality would be rendered as fact; null is the truth and the UI can
    // leave the line out.
    const service = services([
      account({ id: 'u-1', age: null, nationality: null, bio: null, travelStyles: [] }),
    ]);
    const [only] = (await service.listTravelers({}, browsing, 'me')).travelers;
    expect(only).toMatchObject({ age: null, nationality: null, bio: null, tags: [] });
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

  it('gives every traveler the inputs the scorer needs', async () => {
    for (const t of TRAVELER_SEED) {
      expect(t.preferredHubs.length).toBeGreaterThan(0);
      expect(t.budgetLevel).not.toBeNull();
      expect(t.tags.length).toBeGreaterThan(0);
    }
  });

  it('covers every hub at least twice, so trip history separates the list', async () => {
    for (const hub of HUBS) {
      const count = TRAVELER_SEED.filter((t) => t.preferredHubs.includes(hub)).length;
      expect(count).toBeGreaterThanOrEqual(2);
    }
  });

  it('covers every tag at least three times, so no style filter lands empty', async () => {
    for (const tag of TAGS) {
      const count = TRAVELER_SEED.filter((t) => t.tags.includes(tag)).length;
      expect(count).toBeGreaterThanOrEqual(3);
    }
  });

  it('represents all three budget levels', async () => {
    for (const level of ['budget', 'mid', 'comfort'] as const) {
      expect(TRAVELER_SEED.some((t) => t.budgetLevel === level)).toBe(true);
    }
  });

  it('does not make #SoloVerified read as a gendered marker', async () => {
    const solo = TRAVELER_SEED.filter((t) => t.tags.includes('#SoloVerified'));
    expect(solo.some((t) => t.identifiesAsWoman === true)).toBe(true);
    expect(solo.some((t) => t.identifiesAsWoman === undefined)).toBe(true);
  });

  it('has unique ids', async () => {
    const ids = TRAVELER_SEED.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
