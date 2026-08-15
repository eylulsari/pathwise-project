import { HUBS } from '../hubData';

/** Small formatting/estimation helpers shared across the UI. */

export const formatTry = (n: number): string =>
  `₺${Math.round(n).toLocaleString('tr-TR')}`;

export const formatKm = (n: number): string => `${n.toFixed(1)} km`;

/**
 * Ticket price for display. A zero fee is stated plainly as free; anything the
 * dataset flags as unverified gets a leading "~" so an estimate never reads as
 * a quoted price. `freeLabel` is a parameter because some call sites are
 * translated and others (the HTML export) are not.
 */
export function formatEntryFee(
  entryFeeTry: number,
  approx?: boolean,
  freeLabel = 'Free',
): string {
  if (entryFeeTry === 0) return freeLabel;
  return `${approx ? '~' : ''}${formatTry(entryFeeTry)}`;
}

export function formatDuration(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60);
  const m = Math.round(totalMinutes % 60);
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

/**
 * The dataset says "Hours not verified" where nobody has confirmed a schedule —
 * most of the catalogue, since OSM simply has no `opening_hours` for a street
 * or a small café. Callers check this before printing hours at all.
 *
 * The open/closed question lives in `utils/openingHours.ts`. It used to be a
 * one-line heuristic here that took the FIRST time range in the string and
 * compared it to the browser's clock — which called every Monday-closed museum
 * "open" on a Monday, and answered in the reader's timezone rather than
 * Istanbul's.
 */
const UNVERIFIED_HOURS = /^hours not verified$/i;

export function hasVerifiedHours(openingHours: string | undefined): boolean {
  return Boolean(openingHours) && !UNVERIFIED_HOURS.test(openingHours!.trim());
}

/**
 * Hub id → display name, derived from the generated hub list rather than
 * restated.
 *
 * This was a hand-written map of ten entries, which meant every new hub needed
 * remembering in two places — and forgetting the second one renders a raw slug
 * like `beykoz-anadolu-kavagi` at the user. The backend already owns these
 * names and `hubData.ts` already carries them.
 */
export const HUB_LABEL: Record<string, string> = Object.fromEntries(
  HUBS.map((h) => [h.id, h.name]),
);

export const INTEREST_LABEL: Record<string, string> = {
  food: 'Local Food',
  history: 'History',
  photo: 'Photo / Golden Hour',
  market: 'Markets & Bazaars',
  art: 'Underground Art',
  nature: 'Parks & Shore',
};
