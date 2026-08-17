import { PlacesService } from '../../../places/application/places.service';
import { InMemoryPlaceRepository } from '../../../places/infrastructure/persistence/in-memory-place.repository';
import { Place } from '../../../places/domain/place';
import { RouteGenerationInput } from '../../domain/itinerary';
import { HubBudgetStrategy } from './hub-budget.strategy';
import { QuizVibeStrategy } from './quiz-vibe.strategy';

/**
 * What the four new quiz answers actually change.
 *
 * The backwards-compatibility spec proves an unanswered question changes
 * nothing; on its own that is also what a wire that was never connected would
 * prove. These are the other half.
 */

const places = new PlacesService(new InMemoryPlaceRepository());
const strategy = new HubBudgetStrategy(places);
const quizVibe = new QuizVibeStrategy(strategy);

const base = (over: Partial<RouteGenerationInput> = {}): RouteGenerationInput => ({
  hub: 'beyoglu-taksim',
  budgetTry: 3000,
  paceHours: 7,
  group: 'friends',
  interests: ['nightlife', 'food'],
  mustVisitIds: [],
  weather: 'sunny',
  startHour: 11,
  ...over,
});

const realStops = (stops: { place: Place | null }[]) =>
  stops.filter((s) => s.place).map((s) => s.place as Place);

describe('who you are travelling with', () => {
  it('pushes nightlife down the list for a family, without banning it', async () => {
    // Beyoğlu is the fair test: asking for nightlife in a hub that has it, so
    // the difference can only come from the group.
    const friends = await strategy.generate(base({ group: 'friends' }));
    const family = await strategy.generate(base({ group: 'family' }));

    const nightlifeCount = (stops: Place[]) =>
      stops.filter((p) => p.interests.includes('nightlife')).length;

    expect(nightlifeCount(realStops(friends.stops))).toBeGreaterThan(0);
    expect(nightlifeCount(realStops(family.stops))).toBeLessThan(
      nightlifeCount(realStops(friends.stops)),
    );
  });

  it('still costs a family day for four, not for one', async () => {
    const solo = await strategy.generate(base({ group: 'solo' }));
    const family = await strategy.generate(base({ group: 'family' }));
    expect(family.costBreakdown.foodTry).toBeGreaterThan(
      solo.costBreakdown.foodTry,
    );
  });

  it('carries the party answer from the quiz into the day it describes', async () => {
    const result = await quizVibe.generate(
      base({
        group: 'solo',
        quiz: {
          mood: 'foodie',
          pace: 'moderate',
          budgetTry: 2000,
          party: 'family',
        },
      }),
    );
    expect(result.group).toBe('family');
  });
});

describe('how far you will walk', () => {
  const walkingMeters = (it: { stops: { transportToNext: { mode: string; distanceMeters: number } | null }[] }) =>
    it.stops.reduce(
      (sum, s) => sum + (s.transportToNext?.mode === 'walk' ? s.transportToNext.distanceMeters : 0),
      0,
    );

  it('plans fewer stops when the stop cap is what binds the day', async () => {
    // Eminönü at a packed pace fills its cap exactly (7 of 7), so lowering the
    // cap is what shortens the day here.
    const input = base({ hub: 'eminonu-sirkeci', interests: ['history', 'food'], paceHours: 7 });
    const normal = await strategy.generate(input);
    const short = await strategy.generate({ ...input, walkingTolerance: 'short' });

    expect(realStops(short.stops).length).toBeLessThan(realStops(normal.stops).length);
  });

  it('shortens the walk even when the day was already under its stop cap', async () => {
    // Nişantaşı plans six stops against a cap of seven and still walks over
    // two kilometres. This is the case a stop cap alone does nothing for, and
    // it is why the walking ceiling exists.
    const input = base({ hub: 'nisantasi-sisli', interests: ['history', 'food'], paceHours: 7 });
    const normal = await strategy.generate(input);
    const short = await strategy.generate({ ...input, walkingTolerance: 'short' });

    expect(walkingMeters(normal)).toBeGreaterThan(1500);
    expect(walkingMeters(short)).toBeLessThanOrEqual(1500);
  });

  it('leaves the day alone for the two answers that are not "short"', async () => {
    const unanswered = await strategy.generate(base());
    for (const walkingTolerance of ['moderate', 'long'] as const) {
      const result = await strategy.generate(base({ walkingTolerance }));
      expect(realStops(result.stops).map((p) => p.placeId)).toEqual(
        realStops(unanswered.stops).map((p) => p.placeId),
      );
    }
  });

  it('does not delete the day to make the walk short', async () => {
    // Every hub, at the pace where the ceiling bites hardest: the walking rule
    // may shorten a day but must never trim one that already has three stops
    // or fewer, or "I would rather not walk far" would answer with an errand.
    const hubs = [
      'sultanahmet', 'eminonu-sirkeci', 'beyoglu-taksim', 'karakoy-galata',
      'besiktas-bogaz', 'balat-fener', 'kadikoy-moda', 'uskudar',
      'nisantasi-sisli', 'zeytinburnu-bakirkoy',
    ] as const;
    for (const hub of hubs) {
      const withoutRule = await strategy.generate(
        base({ hub, interests: ['history', 'food'], paceHours: 7 }),
      );
      const withRule = await strategy.generate(
        base({ hub, interests: ['history', 'food'], paceHours: 7, walkingTolerance: 'short' }),
      );
      const before = realStops(withoutRule.stops).length;
      const after = realStops(withRule.stops).length;
      expect(after).toBeGreaterThanOrEqual(Math.min(before, 3));
    }
  });

  it('does not drop a must-visit to satisfy the lower cap', async () => {
    const mustVisitIds = [
      'ChIJ-sultanahmet-hagiasophia',
      'ChIJ-sultanahmet-bluemosque',
      'ChIJ-sultanahmet-topkapi',
      'ChIJ-sultanahmet-basilicacistern',
    ];
    const result = await strategy.generate(
      base({
        hub: 'sultanahmet',
        interests: ['history'],
        paceHours: 7,
        walkingTolerance: 'short',
        mustVisitIds,
      }),
    );
    const ids = realStops(result.stops).map((p) => p.placeId);
    for (const id of mustVisitIds) expect(ids).toContain(id);
  });
});

describe('whether you have been to Istanbul before', () => {
  it('leans on the landmarks for a first visit', async () => {
    const input = base({
      hub: 'sultanahmet',
      interests: ['history'],
      paceHours: 5,
    });
    const firstTime = await strategy.generate({ ...input, visitedBefore: false });
    const returning = await strategy.generate({ ...input, visitedBefore: true });

    const landmarks = (stops: Place[]) =>
      stops.filter((p) => p.placeType === 'landmark').length;

    expect(landmarks(realStops(firstTime.stops))).toBeGreaterThan(
      landmarks(realStops(returning.stops)),
    );
  });

  it('leans on the quieter places for someone coming back', async () => {
    const input = base({
      hub: 'balat-fener',
      interests: ['photo'],
      paceHours: 5,
    });
    const firstTime = await strategy.generate({ ...input, visitedBefore: false });
    const returning = await strategy.generate({ ...input, visitedBefore: true });

    const gems = (stops: Place[]) =>
      stops.filter((p) => p.interests.includes('hiddengem')).length;

    expect(gems(realStops(returning.stops))).toBeGreaterThan(
      gems(realStops(firstTime.stops)),
    );
  });

  it('does not overrule an interest the traveller actually named', async () => {
    // A first-timer who asked for food still gets food, not a day of monuments
    // — the familiarity bonus (+20) sits below one interest match (+25).
    const result = await strategy.generate(
      base({
        hub: 'kadikoy-moda',
        interests: ['food'],
        visitedBefore: false,
      }),
    );
    const stops = realStops(result.stops);
    expect(stops.filter((p) => p.interests.includes('food')).length).toBeGreaterThan(0);
  });

  it('does not change which neighbourhood the quiz picked', async () => {
    const mood = { mood: 'art', pace: 'moderate', budgetTry: 2000 } as const;
    const plain = await quizVibe.generate(base({ quiz: { ...mood } }));
    const answered = await quizVibe.generate(
      base({
        quiz: { ...mood, visitedBefore: false, walkingTolerance: 'short' },
      }),
    );
    expect(answered.hub).toBe(plain.hub);
  });
});
