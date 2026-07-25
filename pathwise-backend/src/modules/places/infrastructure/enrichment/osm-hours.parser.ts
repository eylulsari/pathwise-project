/**
 * Minimal OSM `opening_hours` → human-readable converter. The full grammar is
 * large; we handle the common shapes seen on Istanbul POIs (day ranges + time
 * ranges, multiple ';'-separated rules, 24/7, off/closed) and fall back to the
 * raw string for anything we don't recognise — so the output is always useful.
 */
const DAY_LABEL: Record<string, string> = {
  Mo: 'Mon',
  Tu: 'Tue',
  We: 'Wed',
  Th: 'Thu',
  Fr: 'Fri',
  Sa: 'Sat',
  Su: 'Sun',
  PH: 'Public holidays',
};

function labelDays(days: string): string | null {
  // e.g. "Mo-Su", "Mo-Fr", "Sa", "Mo,We,Fr"
  const range = days.match(/^([A-Za-z]{2})-([A-Za-z]{2})$/);
  if (range && DAY_LABEL[range[1]] && DAY_LABEL[range[2]]) {
    return `${DAY_LABEL[range[1]]}–${DAY_LABEL[range[2]]}`;
  }
  const list = days.split(',').map((d) => DAY_LABEL[d]);
  if (list.every(Boolean)) return list.join(', ');
  return null;
}

export function parseOsmOpeningHours(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const value = raw.trim();
  if (!value) return null;
  if (value === '24/7') return 'Open 24/7';

  const rules = value.split(';').map((r) => r.trim()).filter(Boolean);
  const parts = rules.map((rule) => {
    if (/^(24\/7)$/.test(rule)) return 'Open 24/7';

    // "<days> <times>" or just "<times>" (implies every day).
    const m = rule.match(/^([A-Za-z,\-]+)\s+(.+)$/);
    if (m) {
      const days = labelDays(m[1]);
      const times = m[2].replace(/\s*,\s*/g, ', ').replace(/-/g, '–');
      if (/^(off|closed)$/i.test(m[2])) return days ? `${days}: closed` : rule;
      if (days) return `${days} ${times}`;
      return rule; // unknown day token → keep raw
    }
    // Times only, e.g. "09:00-19:30".
    if (/^\d{1,2}:\d{2}\s*-\s*\d{1,2}:\d{2}$/.test(rule)) {
      return `Daily ${rule.replace(/-/g, '–')}`;
    }
    return rule; // anything else → keep raw
  });

  return parts.join('; ');
}
