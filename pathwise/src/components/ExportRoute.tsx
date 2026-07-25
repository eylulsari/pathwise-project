import { useNavigate } from 'react-router-dom';
import type { Itinerary } from '../types';
import { useAuth } from '../context/AuthContext';
import { exportItineraryPdf, googleMapsUrl } from '../utils/export';

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

/** Export actions — simulated PDF download + a real Google Maps directions link. */
export function ExportRoute({ itinerary }: { itinerary: Itinerary }) {
  const { isPremium } = useAuth();
  const navigate = useNavigate();

  function onPdf() {
    if (!isPremium && !canExportPdf()) {
      navigate('/premium'); // free monthly limit reached → upgrade
      return;
    }
    if (!isPremium) recordPdfExport();
    exportItineraryPdf(itinerary);
  }

  return (
    <div className="flex gap-2">
      <button
        onClick={onPdf}
        className="rounded-lg border border-white/10 px-3 py-1.5 text-sm font-semibold text-cream/80 hover:text-cream"
      >
        📄 Export PDF{!isPremium && !canExportPdf() ? ' 🔒' : ''}
      </button>
      <a
        href={googleMapsUrl(itinerary)}
        target="_blank"
        rel="noopener noreferrer"
        className="rounded-lg border border-white/10 px-3 py-1.5 text-sm font-semibold text-cream/80 hover:text-cream"
      >
        🗺️ Open in Google Maps
      </a>
    </div>
  );
}
