import { useState } from 'react';
import { api } from '../../services/api';

export function AiRoutePlanner({ onApply, onLoadExample }: { onApply: (placeIds: string[]) => void; onLoadExample: () => void }) {
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState('Kadıköy’de 3 saatlik kahve ve sanat rotası');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setLoading(true);
    setError(null);
    try {
      const route = await api.generateAiRoute(prompt);
      onApply(route.stops.map((stop) => stop.placeId));
      setOpen(false);
    } catch {
      setError('AI rota şu anda oluşturulamadı. Anahtarınızı ve bağlantınızı kontrol edin.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className="btn-accent absolute end-3 top-14 z-[1000] px-3 py-2 text-sm shadow-lg">
        ✨ AI ile Akıllı Rota Oluştur
      </button>
      <button onClick={onLoadExample} className="absolute end-3 top-28 z-[1000] rounded-lg bg-surface-2/95 px-3 py-2 text-sm font-semibold text-ink shadow-lg backdrop-blur hover:bg-surface">
        🗺️ Örnek Rota Yükle
      </button>
      {open && (
        <div className="absolute inset-0 z-[1100] flex items-center justify-center bg-ink/45 p-4">
          <div className="w-full max-w-md rounded-2xl bg-surface p-5 shadow-2xl">
            <h2 className="font-display text-xl font-bold">✨ AI ile Akıllı Rota</h2>
            <p className="mt-1 text-sm text-ink/60">İsteğinizi yazın; Groq durakları rota ve haritaya eklesin.</p>
            <textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} maxLength={500} className="mt-4 min-h-24 w-full rounded-xl border border-ink/15 bg-surface-2 p-3 text-sm outline-none focus:border-iznik" />
            {error && <p className="mt-2 text-sm text-terracotta">{error}</p>}
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setOpen(false)} className="rounded-lg px-3 py-2 text-sm">Vazgeç</button>
              <button onClick={generate} disabled={loading || prompt.trim().length < 3} className="btn-accent flex items-center gap-2 px-4 py-2 text-sm">{loading && <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />}{loading ? 'Oluşturuluyor…' : 'Rotayı Ekle'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
