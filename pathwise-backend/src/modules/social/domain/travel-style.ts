import { TravelTag } from './traveler';

/**
 * Travel-style tags — the vocabulary buddy matching compares on.
 *
 * They live here, in the social domain, because that is the only place they
 * mean anything: `users.travelStyles` is just the column they are stored in.
 */

/**
 * Styles a user may pick for themselves.
 *
 * `#SoloVerified` is deliberately excluded: despite the name it is a curated
 * community badge, not a taste, and letting anyone self-assign it would make
 * it meaningless. It stays readable on other travelers' cards and still counts
 * toward a match when both sides happen to carry it — it simply cannot be
 * chosen from the profile.
 */
export const SELECTABLE_TRAVEL_STYLES: TravelTag[] = [
  '#Foodie',
  '#Backpacker',
  '#CultureSeeker',
  '#PhotoNomad',
  '#SlowTravel',
];

export interface QuizAnswers {
  mood: 'history' | 'foodie' | 'art' | 'photo';
  pace: 'relaxed' | 'moderate' | 'packed';
  budgetTry: number;
}

/** mood → the style it implies. Two moods may land on the same tag. */
const MOOD_STYLE: Record<QuizAnswers['mood'], TravelTag> = {
  history: '#CultureSeeker',
  foodie: '#Foodie',
  art: '#CultureSeeker',
  photo: '#PhotoNomad',
};

/**
 * Below this daily budget the quiz reads as backpacking. Matches the lowest
 * band in `matching.ts` so the two never disagree about what "cheap" means.
 */
const BACKPACKER_BUDGET_MAX = 750;

/**
 * Derive style tags from a completed Vibe Quiz.
 *
 * Only the answers that genuinely imply a style produce one: a `moderate` pace
 * and a mid-range budget say nothing distinctive, so they add nothing rather
 * than filling the profile with noise. A quiz therefore yields one to three
 * tags, never all five.
 */
export function travelStylesFromQuiz(quiz: QuizAnswers): TravelTag[] {
  const styles: TravelTag[] = [MOOD_STYLE[quiz.mood]];
  if (quiz.pace === 'relaxed') styles.push('#SlowTravel');
  if (quiz.budgetTry <= BACKPACKER_BUDGET_MAX) styles.push('#Backpacker');
  return [...new Set(styles)];
}

/**
 * Fold quiz-derived styles into what the user already has.
 *
 * A union, not a replacement: the quiz is primarily a route-building tool, and
 * silently wiping hand-picked tags every time someone rebuilds their day would
 * be a nasty surprise. The trade-off is that repeated quizzes accumulate tags
 * over time — the manual picker in the profile is the release valve, and it is
 * the only thing that can remove one.
 */
export function mergeTravelStyles(existing: string[], derived: TravelTag[]): TravelTag[] {
  return [...new Set([...(existing as TravelTag[]), ...derived])];
}

/** Drop anything not in the vocabulary — the column is a free-form jsonb. */
export function sanitiseTravelStyles(styles: string[]): TravelTag[] {
  const allowed = new Set<string>(SELECTABLE_TRAVEL_STYLES);
  return [...new Set(styles.filter((s): s is TravelTag => allowed.has(s)))];
}
