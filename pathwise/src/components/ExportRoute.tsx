import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Itinerary } from '../types';
import { useAuth } from '../context/AuthContext';
import { exportItineraryPdf, googleMapsUrl } from '../utils/export';
import { downloadIcs } from '../utils/ics';
import { api } from '../services/api';

const PDF_KEY = 'pathwise.pdfExports'; // "YYYY-MM:count"

/** Free plan allows 1 PDF export/month (tracked client-side); premium unlimited. */
function canExportPdf(): boolean {
  const month = new Date().toISOString().slice(0, 7);
  const [m, c] = (localStorage.getItem(PDF_KEY) ?? '').split(':');
  return m !== month || Number(c ?? 0) < 1;
}
function recordPdfExport() {
  const month = new Date().toISOString().slice(0, 7);
  const [m, c] = (localStorage.getItem(PDF_KEY) ?? '').split(':');
  const count = m === month ? Number(c ?? 0) + 1 : 1;
  localStorage.setItem(PDF_KEY, `${month}:${count}`);
}

/** Export menu — PDF (gated), Google Maps directions, and .ics calendar. */
export function ExportRoute({ itinerary }: { itinerary: Itinerary }) {
  const { isPremium } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  function onPdf() {
    setOpen(false);
    if (!isPremium && !canExportPdf()) {
      api.recordPaywall('pdf'); // A6 analytics
      navigate('/premium'); // free monthly limit reached → upgrade
      return;
    }
    if (!isPremium) recordPdfExport();
    exportItineraryPdf(itinerary);
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="rounded-lg border border-ink/10 px-3 py-1.5 text-sm font-semibold text-ink/80 hover:text-ink"
      >
        ⬇ Export ▾
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-[1040]" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-[1041] mt-1 w-56 overflow-hidden rounded-xl border border-ink/10 bg-surface-2 shadow-xl">
            <button onClick={onPdf} className="block w-full px-4 py-2.5 text-left text-sm text-ink/80 hover:bg-ink/5">
              📄 Export PDF{!isPremium && !canExportPdf() ? ' 🔒' : ''}
            </button>
            <a
              href={googleMapsUrl(itinerary)}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setOpen(false)}
              className="block w-full px-4 py-2.5 text-left text-sm text-ink/80 hover:bg-ink/5"
            >
              🗺️ Open in Google Maps
            </a>
            <button
              onClick={() => {
                setOpen(false);
                downloadIcs(itinerary);
              }}
              className="block w-full px-4 py-2.5 text-left text-sm text-ink/80 hover:bg-ink/5"
            >
              📅 Add to Calendar (.ics)
            </button>
          </div>
        </>
      )}
    </div>
  );
}
