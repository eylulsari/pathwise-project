import type { DayShare, Itinerary } from '../types';

/**
 * A plan somebody can actually paste somewhere.
 *
 * WHY THE LINK CARRIES THE PLAN
 * There is no share endpoint. `/api/plan` is behind JwtAuthGuard end to end
 * and takes its user id from the auth context — deliberately, so that no
 * plan endpoint can be pointed at someone else's trip. That is the right
 * design and it means there is nothing on the server for a link to address:
 * copying the dashboard URL would hand a friend a page that shows them their
 * own plan, or the sign-in screen.
 *
 * So the link carries the summary in its fragment and `/s` renders it. A
 * fragment never reaches the server, which is the point twice over: it needs
 * no backend, and the plan is not logged by anything on the way.
 *
 * The cost is length, and length has a limit. `encodeShareLink` refuses past
 * MAX_LINK_CHARS rather than producing a URL that some chat app will silently
 * truncate into a broken link — the caller falls back to offering the text,
 * which was always the more useful half.
 */

/** Past this, a URL stops surviving the round trip through chat apps. */
export const MAX_LINK_CHARS = 1800;

export interface ShareLabels {
  heading: string;
  day: (n: number) => string;
  budget: (spent: string, of: string) => string;
  walking: (km: string) => string;
  stops: (stops: number, days: number) => string;
  lunch: string;
  footer: string;
}

/** Metres walked across a day — the legs the traveller does on foot. */
export function walkingMeters(itinerary: Itinerary): number {
  return itinerary.stops.reduce(
    (sum, s) =>
      s.transportToNext?.mode === 'walk' ? sum + s.transportToNext.distanceMeters : sum,
    0,
  );
}

function lira(value: number): string {
  return `₺${Math.round(value).toLocaleString('tr-TR')}`;
}

/**
 * The pasteable summary: the days, then the two numbers people ask about.
 *
 * Plain text on purpose. It is going into WhatsApp and Telegram, where
 * markdown is inconsistent and a table is unreadable on a phone — so this is
 * lines, times and names, which survive everywhere.
 */
export function buildShareSummary(days: DayShare[], labels: ShareLabels): string {
  const planned = days.filter((d) => d.itinerary);
  const lines: string[] = [labels.heading, ''];

  let stopCount = 0;
  let spent = 0;
  let budget = 0;
  let metres = 0;

  planned.forEach((d, index) => {
    const itinerary = d.itinerary!;
    lines.push(labels.day(index + 1));
    for (const stop of itinerary.stops) {
      const name = stop.place?.name ?? labels.lunch;
      if (stop.place) stopCount += 1;
      lines.push(`  ${stop.arrivalTime}  ${name}`);
    }
    lines.push('');
    spent += itinerary.costBreakdown.totalTry;
    budget += itinerary.budgetTry;
    metres += walkingMeters(itinerary);
  });

  lines.push(labels.budget(lira(spent), lira(budget)));
  lines.push(labels.walking((metres / 1000).toFixed(1)));
  lines.push(labels.stops(stopCount, planned.length));
  lines.push('');
  lines.push(labels.footer);

  return lines.join('\n');
}

// ── the link ────────────────────────────────────────────────────────

/** base64url of the UTF-8 bytes — safe in a fragment, no padding to escape. */
function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(encoded: string): string {
  const padded = encoded.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4));
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

/**
 * A link that opens the plan for anyone, or null when it would be too long.
 *
 * Null is not a failure to hide — the caller says so and offers the text.
 */
export function encodeShareLink(summary: string, origin: string): string | null {
  const url = `${origin}/s#${toBase64Url(summary)}`;
  return url.length > MAX_LINK_CHARS ? null : url;
}

/** The summary back out of a fragment, or null if it is not one of ours. */
export function decodeShareLink(fragment: string): string | null {
  const raw = fragment.startsWith('#') ? fragment.slice(1) : fragment;
  if (!raw) return null;
  try {
    const text = fromBase64Url(raw);
    // Decoded garbage is still a string; a summary always has line breaks and
    // is never empty, which is enough to tell a real one from a stray hash.
    return text.includes('\n') ? text : null;
  } catch {
    return null;
  }
}
