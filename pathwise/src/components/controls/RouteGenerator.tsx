import type { GroupType, Hub, Interest, Weather } from '../../types';
import { HUBS } from '../../hubData';
import { useT } from '../../i18n';

export interface RouteConfig {
  hub: Hub;
  budgetTry: number;
  paceHours: number;
  group: GroupType;
  interests: Interest[];
  weather: Weather;
  startHour: number;
}

const INTERESTS: Interest[] = ['food', 'history', 'photo', 'market', 'art', 'nature'];
const GROUPS: { id: GroupType; icon: string }[] = [
  { id: 'solo', icon: '🧍' },
  { id: 'couple', icon: '👫' },
  { id: 'friends', icon: '👥' },
];

/** The dynamic route generator — hub, budget, pace, group, interests and a
 *  weather/time simulator. Emits config changes; the parent regenerates. */
export function RouteGenerator({
  config,
  onChange,
  onGenerate,
  generating,
}: {
  config: RouteConfig;
  onChange: (patch: Partial<RouteConfig>) => void;
  onGenerate: () => void;
  generating: boolean;
}) {
  const { t } = useT();
  const timeOfDay =
    config.startHour < 12
      ? t('dash.morning')
      : config.startHour < 16
        ? t('dash.afternoon')
        : t('dash.evening');

  return (
    <div className="space-y-5 rounded-2xl border border-white/10 bg-night-800 p-4">
      <h2 className="font-display text-lg font-bold">{t('dash.buildPath')}</h2>

      {/* Hub selector — no default Sultanahmet */}
      <div>
        <Label>{t('dash.hub')}</Label>
        <div className="grid grid-cols-1 gap-1.5">
          {HUBS.map((h) => (
            <button
              key={h.id}
              onClick={() => onChange({ hub: h.id })}
              className={`flex items-center justify-between rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                config.hub === h.id
                  ? 'border-transparent text-night'
                  : 'border-white/10 text-cream/80 hover:border-white/25'
              }`}
              style={config.hub === h.id ? { background: h.accent } : undefined}
            >
              <span className="font-semibold">{h.name}</span>
              <span className="text-xs opacity-70">{h.side}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Budget slider */}
      <div>
        <Label>
          {t('dash.dailyBudget')}: <span className="text-cream">₺{config.budgetTry.toLocaleString('tr-TR')}{config.budgetTry >= 5000 ? '+' : ''}</span>
        </Label>
        <input
          type="range"
          min={300}
          max={5000}
          step={100}
          value={config.budgetTry}
          onChange={(e) => onChange({ budgetTry: Number(e.target.value) })}
          className="w-full accent-fuchsia"
        />
        <div className="flex justify-between text-[10px] text-cream/40">
          <span>₺300</span>
          <span>₺5,000+</span>
        </div>
      </div>

      {/* Pace slider */}
      <div>
        <Label>
          {t('dash.timeAvailable')}: <span className="text-cream">{config.paceHours}{config.paceHours >= 8 ? '+' : ''} {t('dash.hours')}</span>
        </Label>
        <input
          type="range"
          min={2}
          max={8}
          step={1}
          value={config.paceHours}
          onChange={(e) => onChange({ paceHours: Number(e.target.value) })}
          className="w-full accent-violet"
        />
        <div className="flex justify-between text-[10px] text-cream/40">
          <span>2{t('dash.hours').charAt(0)} {t('dash.relaxed')}</span>
          <span>8+ {t('dash.packed')}</span>
        </div>
      </div>

      {/* Group type */}
      <div>
        <Label>{t('dash.group')}</Label>
        <div className="grid grid-cols-3 gap-1.5">
          {GROUPS.map((g) => (
            <button
              key={g.id}
              onClick={() => onChange({ group: g.id })}
              className={`rounded-lg border px-2 py-2 text-sm transition-colors ${
                config.group === g.id
                  ? 'border-violet bg-violet/20 text-cream'
                  : 'border-white/10 text-cream/70 hover:border-white/25'
              }`}
            >
              <div>{g.icon}</div>
              {t(`dash.${g.id}`)}
            </button>
          ))}
        </div>
      </div>

      {/* Interest chips */}
      <div>
        <Label>{t('dash.interests')}</Label>
        <div className="flex flex-wrap gap-1.5">
          {INTERESTS.map((i) => {
            const on = config.interests.includes(i);
            return (
              <button
                key={i}
                onClick={() =>
                  onChange({
                    interests: on
                      ? config.interests.filter((x) => x !== i)
                      : [...config.interests, i],
                  })
                }
                className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                  on
                    ? 'border-transparent bg-accent-gradient text-white'
                    : 'border-white/15 text-cream/70 hover:border-white/30'
                }`}
              >
                {t(`interests.${i}`)}
              </button>
            );
          })}
        </div>
      </div>

      {/* Weather + time simulator */}
      <div>
        <Label>{t('dash.weatherTime')}</Label>
        <div className="flex gap-1.5">
          {(['sunny', 'rainy'] as Weather[]).map((w) => (
            <button
              key={w}
              onClick={() => onChange({ weather: w })}
              className={`flex-1 rounded-lg border px-2 py-1.5 text-sm transition-colors ${
                config.weather === w
                  ? 'border-coral bg-coral/20 text-cream'
                  : 'border-white/10 text-cream/70'
              }`}
            >
              {w === 'sunny' ? `☀️ ${t('dash.sunny')}` : `🌧️ ${t('dash.rainy')}`}
            </button>
          ))}
        </div>
        <div className="mt-2">
          <div className="flex justify-between text-xs text-cream/50">
            <span>{t('dash.start')}: {String(config.startHour).padStart(2, '0')}:00</span>
            <span>{timeOfDay}</span>
          </div>
          <input
            type="range"
            min={7}
            max={19}
            step={1}
            value={config.startHour}
            onChange={(e) => onChange({ startHour: Number(e.target.value) })}
            className="w-full accent-coral"
          />
        </div>
      </div>

      <button onClick={onGenerate} disabled={generating} className="btn-accent w-full">
        {generating ? t('dash.generating') : t('dash.generate')}
      </button>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-cream/50">{children}</p>;
}
