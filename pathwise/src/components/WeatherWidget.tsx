import { useEffect, useState } from 'react';
import { api } from '../services/api';
import { useT } from '../i18n';

type Weather = Awaited<ReturnType<typeof api.getWeather>>;

/** Weather + crowd widget (OpenWeatherMap shaped). */
export function WeatherWidget() {
  const { t } = useT();
  const [w, setW] = useState<Weather | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    api.getWeather().then(setW).finally(() => setLoading(false));
  }, []);
  if (loading) {
    return <div className="flex items-center gap-2 rounded-xl bg-surface-2/95 px-3 py-2 text-xs font-semibold shadow-lg backdrop-blur"><span className="h-4 w-4 animate-spin rounded-full border-2 border-iznik/30 border-t-iznik" /> Canlı hava durumu yükleniyor</div>;
  }
  if (!w) return null;
  const needsOutdoorWarning = typeof w.conditionCode === 'number' && w.conditionCode >= 200 && w.conditionCode < 600;

  const crowdColor =
    w.crowdLevel === 'High'
      ? 'text-terracotta'
      : w.crowdLevel === 'Moderate'
        ? 'text-terracotta'
        : 'text-sage';

  return (
    <div className="rounded-xl border border-white/30 bg-surface-2/95 px-3 py-2 text-sm shadow-lg backdrop-blur">
      <div className="flex items-center gap-2">
      <span className="text-lg">{w.icon}</span>
      <span className="font-semibold">{w.city}: {w.tempC}°C</span>
      {typeof w.feelsLikeC === 'number' && w.feelsLikeC !== w.tempC && (
        <span className="text-ink/40">({t('weather.feelsLike')} {w.feelsLikeC}°)</span>
      )}
      <span className="text-ink/50">{w.condition}</span>
      {typeof w.humidityPct === 'number' && (
        <span className="text-ink/40">💧{w.humidityPct}%</span>
      )}
      <span className="mx-1 text-ink/20">|</span>
      <span className={crowdColor}>{t('weather.crowds')}: {w.crowdLevel}</span>
      </div>
      {needsOutdoorWarning && <span className="mt-2 inline-flex rounded-full bg-terracotta/15 px-2 py-1 text-xs font-semibold text-terracotta">⚠ Açık hava duraklarına dikkat edin</span>}
    </div>
  );
}
