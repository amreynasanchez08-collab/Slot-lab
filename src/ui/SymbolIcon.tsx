import {
  BELL,
  CHERRY,
  LEMON,
  MELON,
  ORANGE,
  PLUM,
  SEVEN,
  SYMBOL_NAMES,
} from '../engine/symbols.ts';

/** Flat vector symbols, drawn in a 100x100 box. */
export function SymbolIcon({ id, size = 64 }: { id: number; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" role="img" aria-label={SYMBOL_NAMES[id]}>
      {renderSymbol(id)}
    </svg>
  );
}

function renderSymbol(id: number) {
  switch (id) {
    case CHERRY:
      return (
        <g>
          <path d="M50 14 C46 34 36 46 30 60 M50 14 C56 34 66 44 70 58" stroke="#2f7d32" strokeWidth="5" fill="none" strokeLinecap="round" />
          <path d="M50 14 C60 8 74 12 78 20 C68 22 58 20 50 14Z" fill="#43a047" />
          <circle cx="30" cy="68" r="17" fill="#d32f2f" />
          <circle cx="70" cy="66" r="17" fill="#e53935" />
          <circle cx="24" cy="62" r="5" fill="#ffffff" opacity="0.55" />
          <circle cx="64" cy="60" r="5" fill="#ffffff" opacity="0.55" />
        </g>
      );
    case LEMON:
      return (
        <g>
          <path d="M12 52 C18 26 46 18 70 26 C82 30 90 40 90 50 C84 76 54 84 30 76 C20 72 12 62 12 52Z" fill="#fdd835" stroke="#f9a825" strokeWidth="3" />
          <ellipse cx="40" cy="40" rx="12" ry="6" fill="#ffffff" opacity="0.5" />
        </g>
      );
    case ORANGE:
      return (
        <g>
          <circle cx="50" cy="56" r="32" fill="#fb8c00" stroke="#ef6c00" strokeWidth="3" />
          <path d="M50 24 C56 12 70 10 76 16 C70 24 60 26 50 24Z" fill="#43a047" />
          <circle cx="40" cy="46" r="7" fill="#ffffff" opacity="0.45" />
        </g>
      );
    case PLUM:
      return (
        <g>
          <ellipse cx="50" cy="56" rx="30" ry="34" fill="#6a1b9a" stroke="#4a148c" strokeWidth="3" />
          <path d="M50 24 C50 34 48 44 46 50" stroke="#4a148c" strokeWidth="3" fill="none" />
          <path d="M52 22 C60 10 74 10 78 16 C72 24 62 26 52 22Z" fill="#43a047" />
          <ellipse cx="38" cy="46" rx="7" ry="10" fill="#ffffff" opacity="0.4" />
        </g>
      );
    case BELL:
      return (
        <g>
          <path d="M50 14 C30 14 26 34 26 52 C26 62 20 68 14 74 L86 74 C80 68 74 62 74 52 C74 34 70 14 50 14Z" fill="#ffc107" stroke="#ff8f00" strokeWidth="3" />
          <circle cx="50" cy="80" r="8" fill="#ff8f00" />
          <rect x="46" y="6" width="8" height="10" rx="3" fill="#ff8f00" />
          <path d="M36 30 C34 40 34 50 34 58" stroke="#ffffff" strokeWidth="4" opacity="0.5" strokeLinecap="round" fill="none" />
        </g>
      );
    case MELON:
      return (
        <g>
          <circle cx="50" cy="52" r="36" fill="#2e7d32" />
          <path d="M50 16 C40 30 40 74 50 88 M32 22 C22 38 24 70 34 84 M68 22 C78 38 76 70 66 84" stroke="#a5d6a7" strokeWidth="5" fill="none" />
          <circle cx="38" cy="38" r="6" fill="#ffffff" opacity="0.35" />
        </g>
      );
    case SEVEN:
      return (
        <g>
          <text x="50" y="80" textAnchor="middle" fontSize="84" fontWeight="900" fontFamily="Georgia, serif" fill="#e53935" stroke="#ffd54f" strokeWidth="4" paintOrder="stroke">
            7
          </text>
        </g>
      );
    default:
      return null;
  }
}

/** Plain scatter star (Plenty on Twenty), without the mystery mark. */
export function StarIcon({ size = 64 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" role="img" aria-label="Estrella">
      <path d="M50 6 L62 36 L94 38 L69 58 L78 90 L50 72 L22 90 L31 58 L6 38 L38 36Z" fill="#ffd54f" stroke="#ff8f00" strokeWidth="3" strokeLinejoin="round" />
      <circle cx="42" cy="46" r="4" fill="#5d3200" />
      <circle cx="58" cy="46" r="4" fill="#5d3200" />
      <path d="M40 58 C46 64 54 64 60 58" stroke="#5d3200" strokeWidth="3.5" fill="none" strokeLinecap="round" />
    </svg>
  );
}
