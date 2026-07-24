/**
 * Istanbul skyline silhouette — Galata Tower, Hagia Sophia domes, the Maiden's
 * Tower and the Bosphorus Bridge. Used in the header, onboarding cards and as a
 * decorative footer. Pure inline SVG so it inherits `currentColor`.
 */
export function IstanbulSilhouette({ className = '' }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 1200 160"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      preserveAspectRatio="xMidYMax meet"
    >
      {/* waterline */}
      <rect x="0" y="150" width="1200" height="10" opacity="0.5" />

      {/* Galata Tower */}
      <g transform="translate(120,0)">
        <rect x="18" y="60" width="24" height="90" />
        <path d="M14 60 L46 60 L40 44 L20 44 Z" />
        <rect x="22" y="30" width="16" height="16" />
        <path d="M22 30 L38 30 L30 14 Z" />
        <rect x="29" y="4" width="2" height="12" />
      </g>

      {/* Hagia Sophia — central dome + semi-domes + minarets */}
      <g transform="translate(430,0)">
        <rect x="0" y="150" width="0" height="0" />
        <path d="M20 150 L20 96 Q90 40 160 96 L160 150 Z" />
        <path d="M60 96 Q90 66 120 96 Z" />
        <ellipse cx="90" cy="70" rx="38" ry="30" />
        <rect x="86" y="30" width="8" height="16" />
        <path d="M84 30 L96 30 L90 20 Z" />
        {/* minarets */}
        <rect x="6" y="70" width="8" height="80" />
        <path d="M4 70 L16 70 L10 58 Z" />
        <rect x="166" y="70" width="8" height="80" />
        <path d="M164 70 L176 70 L170 58 Z" />
      </g>

      {/* Bosphorus Bridge */}
      <g transform="translate(720,0)">
        <rect x="0" y="120" width="220" height="4" />
        <rect x="20" y="56" width="6" height="66" />
        <rect x="194" y="56" width="6" height="66" />
        <path d="M23 56 Q110 150 197 56" fill="none" stroke="currentColor" strokeWidth="3" />
        {Array.from({ length: 10 }).map((_, i) => (
          <rect key={i} x={30 + i * 18} y={92 + Math.abs(5 - i) * 2} width="2" height={28 - Math.abs(5 - i) * 2} />
        ))}
      </g>

      {/* Maiden's Tower */}
      <g transform="translate(1010,0)">
        <rect x="20" y="118" width="60" height="32" />
        <rect x="40" y="70" width="20" height="48" />
        <path d="M36 70 L64 70 L58 58 L42 58 Z" />
        <path d="M42 58 L58 58 L50 40 Z" />
        <rect x="49" y="26" width="2" height="14" />
      </g>
    </svg>
  );
}
