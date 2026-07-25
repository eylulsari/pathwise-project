import { useEffect, useState } from 'react';
import { api } from '../services/api';
import { useT } from '../i18n';

type Weather = Awaited<ReturnType<typeof api.getWeather>>;

/** Weather + crowd widget (OpenWeatherMap shaped). */
export function WeatherWidget() {
  const { t } = useT();
  const [w, setW] = useState<Weather | null>(null);
  useEffect(() => {
    api.getWeather().then(setW);
  }, []);
  if (!w) return null;

  const crowdColor =
    w.crowdLevel === 'High'
      ? 'text-fuchsia'
      : w.crowdLevel === 'Moderate'
        ? 'text-coral'
        : 'text-emerald';

  return (
    <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-night-800 px-3 py-2 text-sm">
      <span className="text-lg">{w.icon}</span>
      <span className="font-semibold">{w.city}: {w.tempC}°C</span>
      {typeof w.feelsLikeC === 'number' && w.feelsLikeC !== w.tempC && (
        <span className="text-cream/40">({t('weather.feelsLike')} {w.feelsLikeC}°)</span>
      )}
      <span className="text-cream/50">{w.condition}</span>
      {typeof w.humidityPct === 'number' && (
        <span className="text-cream/40">💧{w.humidityPct}%</span>
      )}
      <span className="mx-1 text-cream/20">|</span>
      <span className={crowdColor}>{t('weather.crowds')}: {w.crowdLevel}</span>
    </div>
  );
}
