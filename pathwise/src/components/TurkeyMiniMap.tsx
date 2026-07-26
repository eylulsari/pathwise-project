/**
 * Stylized Türkiye mini-map. A simplified country outline with dots at
 * approximate positions for a handful of provinces; visited ones light up.
 * (A production build would use real province GeoJSON.)
 */
const PROVINCE_POINTS: Record<string, [number, number]> = {
  // x,y in a 0–300 × 0–120 viewBox (west→east, north→south, roughly)
  İstanbul: [70, 34],
  Edirne: [40, 30],
  Çanakkale: [38, 52],
  Bursa: [72, 48],
  İzmir: [42, 72],
  Muğla: [64, 92],
  Antalya: [104, 90],
  Nevşehir: [160, 66],
  Gaziantep: [206, 92],
  Kars: [272, 46],
  Trabzon: [232, 40],
  Edremit: [50, 58],
};

import { useT } from '../i18n';

export function TurkeyMiniMap({ visited }: { visited: string[] }) {
  const { t } = useT();
  const visitedSet = new Set(visited);
  return (
    <div className="rounded-xl border border-ink/10 bg-ink/5 p-3">
      <svg viewBox="0 0 300 120" className="w-full">
        {/* Simplified Anatolia silhouette */}
        <path
          d="M30 46 Q60 24 110 30 Q160 20 210 30 Q250 26 285 44 Q292 60 278 74 Q240 92 200 86 Q150 100 100 90 Q60 96 40 78 Q22 64 30 46 Z"
          fill="rgba(74,124,130,0.12)"
          stroke="rgba(74,124,130,0.4)"
          strokeWidth="1.5"
        />
        {Object.entries(PROVINCE_POINTS).map(([name, [x, y]]) => {
          const on = visitedSet.has(name);
          return (
            <g key={name}>
              <circle cx={x} cy={y} r={on ? 4 : 2.5} fill={on ? '#4A7C82' : 'rgba(61,50,41,0.20)'} />
              {on && (
                <text x={x + 5} y={y + 3} fontSize="7" fill="#3D3229" className="font-semibold">
                  {name}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <p className="mt-1 text-center text-xs text-ink/50">
        {visited.length} {t('social.provincesVisited')}
      </p>
    </div>
  );
}
