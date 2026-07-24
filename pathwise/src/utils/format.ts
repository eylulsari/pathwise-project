/** Small formatting/estimation helpers shared across the UI. */

export const formatTry = (n: number): string =>
  `₺${Math.round(n).toLocaleString('tr-TR')}`;

export const formatKm = (n: number): string => `${n.toFixed(1)} km`;

export function formatDuration(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60);
  const m = Math.round(totalMinutes % 60);
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

/**
 * Rough open/closed estimate from a Google-style opening_hours string.
 * Parses the first "HH:MM–HH:MM" range it finds; treats "Always open" as open.
 * This is a display heuristic, not an authoritative schedule.
 */
export function isOpenNow(openingHours: string, now = new Date()): boolean | null {
  if (/always open/i.test(openingHours)) return true;
  const match = openingHours.match(/(\d{1,2}):(\d{2})\s*[–-]\s*(\d{1,2}):(\d{2})/);
  if (!match) return null; // unknown / prayer-time dependent
  const [, sh, sm, eh, em] = match.map(Number) as unknown as number[];
  const cur = now.getHours() * 60 + now.getMinutes();
  const start = sh * 60 + sm;
  const end = eh * 60 + em;
  return cur >= start && cur <= end;
}

export const HUB_LABEL: Record<string, string> = {
  sultanahmet: 'Sultanahmet & Old City',
  'karakoy-galata': 'Karaköy & Galata',
  'kadikoy-moda': 'Kadıköy & Moda',
  'balat-fener': 'Balat & Fener',
  'besiktas-bogaz': 'Beşiktaş & Bosphorus',
};

export const INTEREST_LABEL: Record<string, string> = {
  food: 'Local Food',
  history: 'History',
  photo: 'Photo / Golden Hour',
  market: 'Markets & Bazaars',
  art: 'Underground Art',
  nature: 'Parks & Shore',
};
