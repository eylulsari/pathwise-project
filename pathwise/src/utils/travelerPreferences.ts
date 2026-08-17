import type { DietaryRestriction } from '../types';

/**
 * The dietary answer, kept on the device.
 *
 * It lives here rather than in the plan or the user record for one reason: it
 * is not an input to anything the server computes. The route engine must not
 * see it — nothing in the place data says whether a kitchen can feed a vegan,
 * so filtering on it would be theatre — and the only consumer is the assistant,
 * which receives it per request. Giving it a column and a migration would imply
 * the app does something with it that it does not.
 *
 * The cost is honest and small: it does not follow the traveller to another
 * device, and they would answer the quiz again there anyway.
 */
const KEY = 'pathwise.dietary';

const VALID: DietaryRestriction[] = ['vegetarian', 'vegan', 'no-seafood'];

export function getDietary(): DietaryRestriction | undefined {
  try {
    const raw = localStorage.getItem(KEY);
    return VALID.includes(raw as DietaryRestriction)
      ? (raw as DietaryRestriction)
      : undefined;
  } catch {
    // Private browsing, or storage disabled. The assistant simply gets no
    // dietary context, which is exactly what it gets for everyone who has not
    // answered the question.
    return undefined;
  }
}

/** `undefined` means "no restriction", and clears any earlier answer. */
export function setDietary(value: DietaryRestriction | undefined): void {
  try {
    if (value) localStorage.setItem(KEY, value);
    else localStorage.removeItem(KEY);
  } catch {
    /* nothing to do — see above */
  }
}
