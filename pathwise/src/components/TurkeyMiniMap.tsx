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

export function TurkeyMiniMap({ visited }: { visited: string[] }) {
  const visitedSet = new Set(visited);
  return (
    <div className="rounded-xl border border-night/10 bg-night/5 p-3">
      <svg viewBox="0 0 300 120" className="w-full">
        {/* Simplified Anatolia silhouette */}
        <path
          d="M30 46 Q60 24 110 30 Q160 20 210 30 Q250 26 285 44 Q292 60 278 74 Q240 92 200 86 Q150 100 100 90 Q60 96 40 78 Q22 64 30 46 Z"
          fill="rgba(139,92,246,0.12)"
          stroke="rgba(139,92,246,0.4)"
          strokeWidth="1.5"
        />
        {Object.entries(PROVINCE_POINTS).map(([name, [x, y]]) => {
          const on = visitedSet.has(name);
          return (
            <g key={name}>
              <circle cx={x} cy={y} r={on ? 4 : 2.5} fill={on ? '#EC4899' : 'rgba(19,17,41,0.25)'} />
              {on && (
                <text x={x + 5} y={y + 3} fontSize="7" fill="#131129" className="font-semibold">
                  {name}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <p className="mt-1 text-center text-xs text-night/50">
        {visited.length} provinces visited
      </p>
    </div>
  );
}
