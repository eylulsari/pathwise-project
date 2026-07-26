import type { Itinerary } from '../types';

/** Build a real Google Maps directions URL from the ordered stops (walking). */
export function googleMapsUrl(itinerary: Itinerary): string {
  const pts = itinerary.stops
    .map((s) => s.place)
    .filter((p): p is NonNullable<typeof p> => p !== null)
    .map((p) => `${p.lat},${p.lng}`);
  if (pts.length === 0) return 'https://www.google.com/maps';
  const destination = pts[pts.length - 1];
  const waypoints = pts.slice(0, -1).join('|');
  const params = new URLSearchParams({
    api: '1',
    destination,
    travelmode: 'walking',
  });
  if (waypoints) params.set('waypoints', waypoints);
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

/**
 * Simulated PDF export. Rather than pulling a heavy PDF library we open a
 * print-ready window; the browser's "Save as PDF" produces the file. (A real
 * build would render server-side with e.g. Puppeteer.)
 */
export function exportItineraryPdf(itinerary: Itinerary): void {
  const rows = itinerary.stops
    .map((s) => {
      const name = s.isLunchBreak ? '🍽️ Lunch Break' : s.place?.name;
      return `<tr><td>${s.arrivalTime}–${s.departureTime}</td><td>${name}</td><td>₺${s.entryFeeTry}</td><td>₺${s.foodCostTry}</td></tr>`;
    })
    .join('');

  const html = `<!doctype html><html><head><title>Pathwise itinerary</title>
    <style>
      body{font-family:system-ui,sans-serif;padding:32px;color:#3D3229}
      h1{color:#4A7C82} table{width:100%;border-collapse:collapse;margin-top:16px}
      td,th{border-bottom:1px solid #eee;padding:8px;text-align:left;font-size:14px}
      .total{margin-top:16px;font-weight:700}
    </style></head><body>
    <h1>Pathwise · Istanbul day plan</h1>
    <p>${itinerary.hub} · ${itinerary.totalDistanceKm} km · ${itinerary.stops.length} stops</p>
    <table><thead><tr><th>Time</th><th>Stop</th><th>Ticket</th><th>Food</th></tr></thead><tbody>${rows}</tbody></table>
    <p class="total">Total: ₺${itinerary.costBreakdown.totalTry} (budget ₺${itinerary.budgetTry})</p>
    </body></html>`;

  const w = window.open('', '_blank');
  if (!w) return;
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 400);
}
