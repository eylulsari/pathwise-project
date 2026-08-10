import {
  budgetLevelFromSpend,
  MatchProfile,
  MATCH_WEIGHTS,
  rankByScore,
  scoreMatch,
} from './matching';
import {
  mergeTravelStyles,
  sanitiseTravelStyles,
  travelStylesFromQuiz,
} from './travel-style';

const profile = (p: Partial<MatchProfile> = {}): MatchProfile => ({
  styles: [],
  preferredHubs: [],
  budgetLevel: null,
  ...p,
});

describe('scoreMatch', () => {
  it('scores a perfect match at 100', () => {
    const a = profile({
      styles: ['#Foodie', '#Backpacker'],
      preferredHubs: ['kadikoy-moda'],
      budgetLevel: 'budget',
    });
    expect(scoreMatch(a, a).score).toBe(100);
  });

  it('scores nothing-in-common at 0', () => {
    const a = profile({
      styles: ['#Foodie'],
      preferredHubs: ['kadikoy-moda'],
      budgetLevel: 'budget',
    });
    const b = profile({
      styles: ['#CultureSeeker'],
      preferredHubs: ['sultanahmet'],
      budgetLevel: 'comfort',
    });
    expect(scoreMatch(a, b).score).toBe(0);
  });

  it('is symmetric', () => {
    const a = profile({ styles: ['#Foodie', '#SlowTravel'], budgetLevel: 'mid' });
    const b = profile({ styles: ['#Foodie'], budgetLevel: 'comfort' });
    expect(scoreMatch(a, b).score).toBe(scoreMatch(b, a).score);
  });

  it('weights style above hub above budget', () => {
    // One component perfect, the others at zero — the resulting score should
    // rank in the same order as the weights.
    const base = (): MatchProfile =>
      profile({
        styles: ['#Foodie'],
        preferredHubs: ['kadikoy-moda'],
        budgetLevel: 'budget',
      });
    const styleOnly = scoreMatch(
      base(),
      profile({ styles: ['#Foodie'], preferredHubs: ['sultanahmet'], budgetLevel: 'comfort' }),
    ).score!;
    const hubOnly = scoreMatch(
      base(),
      profile({ styles: ['#PhotoNomad'], preferredHubs: ['kadikoy-moda'], budgetLevel: 'comfort' }),
    ).score!;
    const budgetOnly = scoreMatch(
      base(),
      profile({ styles: ['#PhotoNomad'], preferredHubs: ['sultanahmet'], budgetLevel: 'budget' }),
    ).score!;

    expect(styleOnly).toBeGreaterThan(hubOnly);
    expect(hubOnly).toBeGreaterThan(budgetOnly);
    expect(styleOnly).toBe(MATCH_WEIGHTS.style);
  });

  it('treats adjacent budget bands as half a match', () => {
    const a = profile({ budgetLevel: 'budget' });
    const b = profile({ budgetLevel: 'mid' });
    // Budget is the only available component, so it decides the whole score.
    expect(scoreMatch(a, b).score).toBe(50);
    expect(scoreMatch(a, profile({ budgetLevel: 'comfort' })).score).toBe(0);
  });

  // ── Missing data is skipped, not scored as zero ─────────────────────
  it('returns null when nothing at all can be compared', () => {
    const newcomer = profile();
    const someone = profile({ styles: ['#Foodie'], preferredHubs: ['kadikoy-moda'] });
    expect(scoreMatch(newcomer, someone).score).toBeNull();
  });

  it('renormalises over the components it can evaluate', () => {
    // The viewer has styles but no trips, so hub and budget are unknown. A
    // full style match must still read as 100, not as the 50 it would score
    // if the missing components were counted as zeros.
    const viewer = profile({ styles: ['#Foodie'] });
    const other = profile({
      styles: ['#Foodie'],
      preferredHubs: ['sultanahmet'],
      budgetLevel: 'comfort',
    });
    const result = scoreMatch(viewer, other);
    expect(result.score).toBe(100);
    expect(result.components.hub.value).toBeNull();
    expect(result.components.budget.value).toBeNull();
  });

  it('uses the overlap coefficient so a longer tag list is not penalised', () => {
    // Two shared tags out of the smaller set of two = a full style match,
    // even though the other side lists five.
    const short = profile({ styles: ['#Foodie', '#SlowTravel'] });
    const long = profile({
      styles: ['#Foodie', '#SlowTravel', '#Backpacker', '#PhotoNomad', '#CultureSeeker'],
    });
    expect(scoreMatch(short, long).score).toBe(100);
  });

  it('reports the shared tags so the number can be explained', () => {
    const result = scoreMatch(
      profile({ styles: ['#Foodie', '#Backpacker'], preferredHubs: ['kadikoy-moda'] }),
      profile({ styles: ['#Foodie', '#PhotoNomad'], preferredHubs: ['kadikoy-moda'] }),
    );
    expect(result.sharedStyles).toEqual(['#Foodie']);
    expect(result.sharedHubs).toEqual(['kadikoy-moda']);
  });
});

describe('budgetLevelFromSpend', () => {
  it('buckets by daily spend', () => {
    expect(budgetLevelFromSpend(400)).toBe('budget');
    expect(budgetLevelFromSpend(750)).toBe('budget'); // inclusive boundary
    expect(budgetLevelFromSpend(1500)).toBe('mid');
    expect(budgetLevelFromSpend(2001)).toBe('comfort');
  });
});

describe('rankByScore', () => {
  it('sorts high to low and sinks unscored travelers to the bottom', () => {
    const ranked = rankByScore([
      { id: 'a', matchScore: 40 },
      { id: 'b', matchScore: null },
      { id: 'c', matchScore: 90 },
    ]);
    expect(ranked.map((r) => r.id)).toEqual(['c', 'a', 'b']);
  });

  it('keeps the original order among equals (stable)', () => {
    const ranked = rankByScore([
      { id: 'a', matchScore: 50 },
      { id: 'b', matchScore: 50 },
      { id: 'c', matchScore: 50 },
    ]);
    expect(ranked.map((r) => r.id)).toEqual(['a', 'b', 'c']);
  });

  it('does not mutate its input', () => {
    const input = [{ id: 'a', matchScore: 1 }, { id: 'b', matchScore: 9 }];
    rankByScore(input);
    expect(input.map((r) => r.id)).toEqual(['a', 'b']);
  });
});

describe('travelStylesFromQuiz', () => {
  it('maps the mood to a style', () => {
    expect(travelStylesFromQuiz({ mood: 'foodie', pace: 'moderate', budgetTry: 2000 })).toEqual([
      '#Foodie',
    ]);
    expect(travelStylesFromQuiz({ mood: 'photo', pace: 'moderate', budgetTry: 2000 })).toEqual([
      '#PhotoNomad',
    ]);
  });

  it('adds #SlowTravel for a relaxed pace and #Backpacker for a low budget', () => {
    expect(travelStylesFromQuiz({ mood: 'history', pace: 'relaxed', budgetTry: 500 })).toEqual([
      '#CultureSeeker',
      '#SlowTravel',
      '#Backpacker',
    ]);
  });

  it('says nothing about a middling answer rather than inventing a tag', () => {
    // A moderate pace at a mid budget is not distinctive, so it adds nothing.
    const styles = travelStylesFromQuiz({ mood: 'art', pace: 'moderate', budgetTry: 3000 });
    expect(styles).toEqual(['#CultureSeeker']);
  });
});

describe('mergeTravelStyles / sanitiseTravelStyles', () => {
  it('unions rather than replacing, so manual picks survive a quiz', () => {
    expect(mergeTravelStyles(['#SlowTravel'], ['#Foodie'])).toEqual(['#SlowTravel', '#Foodie']);
  });

  it('does not duplicate a tag the user already had', () => {
    expect(mergeTravelStyles(['#Foodie'], ['#Foodie', '#Backpacker'])).toEqual([
      '#Foodie',
      '#Backpacker',
    ]);
  });

  it('drops unknown tags and the non-selectable badge', () => {
    expect(sanitiseTravelStyles(['#Foodie', '#NotAThing', '#SoloVerified'])).toEqual(['#Foodie']);
  });

  it('de-duplicates', () => {
    expect(sanitiseTravelStyles(['#Foodie', '#Foodie'])).toEqual(['#Foodie']);
  });
});
