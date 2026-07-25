import type { Itinerary } from '../types';

/**
 * Build an iCalendar (.ics) file from an itinerary — one VEVENT per stop, timed
 * by its arrival/departure. Reservation ticket/confirmation codes are added to
 * the event description. Hand-rolled (no library) per spec.
 */
function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** Today's date + "HH:mm" → floating local iCal timestamp YYYYMMDDTHHMMSS. */
function icalTime(hhmm: string, base = new Date()): string {
  const [h, m] = hhmm.split(':').map(Number);
  const y = base.getFullYear();
  const mo = pad(base.getMonth() + 1);
  const d = pad(base.getDate());
  return `${y}${mo}${d}T${pad(h)}${pad(m)}00`;
}

/** Escape text per RFC 5545 (commas, semicolons, newlines). */
function esc(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/[,;]/g, (c) => '\\' + c).replace(/\n/g, '\\n');
}

export function buildIcs(itinerary: Itinerary): string {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Pathwise//Istanbul Itinerary//EN',
    'CALSCALE:GREGORIAN',
  ];

  itinerary.stops
    .filter((s) => s.place)
    .forEach((s, i) => {
      const p = s.place!;
      const descParts = [p.localTip];
      if (s.reservation) {
        descParts.push(
          `Reservation ${s.reservation.time}` +
            (s.reservation.confirmationCode ? ` — code ${s.reservation.confirmationCode}` : '') +
            (s.reservation.note ? ` (${s.reservation.note})` : ''),
        );
      }
      lines.push(
        'BEGIN:VEVENT',
        `UID:pathwise-${itinerary.generatedAt}-${i}@pathwise.app`,
        `DTSTAMP:${icalTime(s.arrivalTime)}`,
        `DTSTART:${icalTime(s.arrivalTime)}`,
        `DTEND:${icalTime(s.departureTime)}`,
        `SUMMARY:${esc(p.name)}`,
        `DESCRIPTION:${esc(descParts.join(' | '))}`,
        `LOCATION:${esc(p.name)} (${p.lat},${p.lng})`,
        'END:VEVENT',
      );
    });

  lines.push('END:VCALENDAR');
  // iCal requires CRLF line endings.
  return lines.join('\r\n');
}

/** Trigger a download of the .ics file. */
export function downloadIcs(itinerary: Itinerary): void {
  const blob = new Blob([buildIcs(itinerary)], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `pathwise-${itinerary.hub}.ics`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
